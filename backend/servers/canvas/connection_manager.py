import asyncio
import json
import os
from fastapi import WebSocket

SERVER_ID = os.getenv("SERVER_ID", "server1")
OWNER_TIMEOUT = int(os.getenv("OWNER_ABSENCE_TIMEOUT", "300"))

class ConnectionManager:
    def __init__(self):
        # room_id -> {user_id -> WebSocket}
        self.connections: dict[str, dict[str, WebSocket]] = {}
        # room_id -> owner user_id
        self.room_owners: dict[str, str] = {}
        # room_id -> asyncio.Task
        self.absence_timers: dict[str, asyncio.Task] = {}
        # callback: async fn(room_id) called when absence timer fires
        self._on_owner_absent = None

    def set_owner_absent_callback(self, fn):
        self._on_owner_absent = fn

    async def connect(self, ws: WebSocket, room_id: str, user_id: str, is_owner: bool):
        await ws.accept()
        if room_id not in self.connections:
            self.connections[room_id] = {}
        self.connections[room_id][user_id] = ws
        if is_owner:
            self.room_owners[room_id] = user_id
            self._cancel_timer(room_id)
        print(f"[{SERVER_ID}] {user_id} connected to room {room_id}")

    async def disconnect(self, room_id: str, user_id: str):
        self.connections.get(room_id, {}).pop(user_id, None)
        print(f"[{SERVER_ID}] {user_id} disconnected from room {room_id}")
        if self.room_owners.get(room_id) == user_id:
            self._start_timer(room_id)

    async def broadcast_local(self, room_id: str, data: bytes, exclude: str = None):
        dead = []
        for uid, ws in self.connections.get(room_id, {}).items():
            if uid == exclude:
                continue
            try:
                try:
                    await ws.send_text(data.decode())
                except (UnicodeDecodeError, AttributeError):
                    await ws.send_bytes(data)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.connections[room_id].pop(uid, None)

    async def send_to_user(self, room_id: str, user_id: str, data: bytes):
        ws = self.connections.get(room_id, {}).get(user_id)
        if ws:
            try:
                try:
                    await ws.send_text(data.decode())
                except (UnicodeDecodeError, AttributeError):
                    await ws.send_bytes(data)
            except Exception:
                pass

    def is_connected(self, room_id: str, user_id: str) -> bool:
        return user_id in self.connections.get(room_id, {})

    def _start_timer(self, room_id: str):
        self._cancel_timer(room_id)

        async def countdown():
            await asyncio.sleep(OWNER_TIMEOUT)
            print(f"[{SERVER_ID}] Owner absent timeout fired for room {room_id}")
            if self._on_owner_absent:
                await self._on_owner_absent(room_id)

        self.absence_timers[room_id] = asyncio.create_task(countdown())
        print(f"[{SERVER_ID}] Owner absence timer started for room {room_id}")

    def _cancel_timer(self, room_id: str):
        task = self.absence_timers.pop(room_id, None)
        if task:
            task.cancel()
        print(f"[{SERVER_ID}] Owner absence timer cancelled for room {room_id}")

manager = ConnectionManager()