import asyncio
import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from canvas.database import (
    get_members,
    init_db,
    get_room,
    is_member,
    get_snapshot,
    upsert_snapshot,
    remove_member,
    set_room_inactive
)
from canvas.redis_client import init_redis, close_redis, get_redis, publish
from canvas.connection_manager import manager

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
SERVER_ID = os.getenv("SERVER_ID", "server1")


control_connections: dict[str, dict[str, WebSocket]] = {}


async def on_owner_absent(room_id: str):
    await set_room_inactive(room_id)
    msg = json.dumps({
        "type": "room_closing",
        "reason": "owner_absent"
    }).encode()
    await manager.broadcast_local(room_id, msg)
    await publish(room_id, msg)

manager.set_owner_absent_callback(on_owner_absent)


async def broadcast_to_control(room_id: str, raw: bytes):
    dead = []
    for uid, ws in control_connections.get(room_id, {}).items():
        try:
            await ws.send_text(raw.decode())
        except Exception:
            dead.append(uid)
    for uid in dead:
        control_connections.get(room_id, {}).pop(uid, None)


async def redis_subscriber():
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.psubscribe("room:*")
    print(f"[{SERVER_ID}] Redis subscriber started")

    async for message in pubsub.listen():
        if message["type"] != "pmessage":
            continue

        channel: bytes = message["channel"]
        room_id = channel.decode().split(":", 1)[1]
        raw: bytes = message["data"]

        try:
            control = json.loads(raw)
            msg_type = control.get("type")

            if msg_type in ("room_closing", "user_joined", "user_left"):
                await manager.broadcast_local(room_id, raw)
                await broadcast_to_control(room_id, raw)

            elif msg_type == "kick":
                kicked_uid = control.get("user_id")
                if manager.is_connected(room_id, kicked_uid):
                    await manager.send_to_user(room_id, kicked_uid, raw)
                ws = control_connections.get(room_id, {}).get(kicked_uid)
                if ws:
                    try:
                        await ws.send_text(raw.decode())
                    except Exception:
                        control_connections.get(room_id, {}).pop(kicked_uid, None)

        except (json.JSONDecodeError, UnicodeDecodeError):
            await manager.broadcast_local(room_id, raw)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_redis()
    task = asyncio.create_task(redis_subscriber())
    print(f"[{SERVER_ID}] started")
    yield
    task.cancel()
    await close_redis()

app = FastAPI(lifespan=lifespan)


def decode_token(token: str) -> dict:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return {
        "user_id": payload.get("user_id"),
        "username": payload.get("sub")
    }


@app.websocket("/ws/{room_id}")
async def canvas_ws(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...)
):
    try:
        user = decode_token(token)
        user_id = user["user_id"]
        username = user["username"]
    except JWTError:
        await websocket.close(code=4001)
        return

    if not user_id:
        await websocket.close(code=4001)
        return

    room = await get_room(room_id)
    if not room or not room.is_active:
        await websocket.close(code=4004)
        return

    member = await is_member(room_id, user_id)
    if not member:
        await websocket.close(code=4003)
        return

    is_owner = str(room.owner_id) == str(user_id)

    await manager.connect(websocket, room_id, user_id, is_owner)

    snapshot = await get_snapshot(room_id)
    if snapshot:
        try:
            await websocket.send_text(snapshot.decode())
        except (UnicodeDecodeError, AttributeError):
            await websocket.send_bytes(snapshot)

    join_msg = json.dumps({
        "type": "user_joined",
        "user_id": user_id,
        "username": username
    }).encode()
    await manager.broadcast_local(room_id, join_msg, exclude=user_id)
    await publish(room_id, join_msg)

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"]:
                data = message["bytes"]
            elif "text" in message and message["text"]:
                data = message["text"].encode()
            else:
                continue

            await manager.broadcast_local(room_id, data, exclude=user_id)
            await publish(room_id, data)
            await upsert_snapshot(room_id, data)

    except WebSocketDisconnect:
        pass

    await manager.disconnect(room_id, user_id)
    await remove_member(room_id, user_id)

    leave_msg = json.dumps({
        "type": "user_left",
        "user_id": user_id,
        "username": username
    }).encode()
    await manager.broadcast_local(room_id, leave_msg)
    await publish(room_id, leave_msg)

    pass


@app.websocket("/control/{room_id}")
async def control_ws(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...)
):
    try:
        user = decode_token(token)
        user_id = user["user_id"]
    except JWTError:
        await websocket.close(code=4001)
        return

    if not user_id:
        await websocket.close(code=4001)
        return

    room = await get_room(room_id)
    if not room or not room.is_active:
        await websocket.close(code=4004)
        return

    member = await is_member(room_id, user_id)
    if not member:
        await websocket.close(code=4003)
        return

    await websocket.accept()


    if room_id not in control_connections:
        control_connections[room_id] = {}
    control_connections[room_id][user_id] = websocket

    # Send initial members list
    existing_members = await get_members(room_id)
    await websocket.send_text(json.dumps({
        "type": "members_list",
        "members": existing_members
    }))

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
       
        control_connections.get(room_id, {}).pop(user_id, None)


@app.get("/health")
async def health():
    return {"status": "ok", "server": SERVER_ID}