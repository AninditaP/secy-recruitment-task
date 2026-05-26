from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from jose import jwt, JWTError
from canvas.database import (
    create_room,
    get_room,
    add_member,
    remove_member,
    get_member_count,
    is_member,
    set_room_inactive,
    get_members
)
from canvas.redis_client import publish
import os, json

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
router = APIRouter(prefix="/rooms")

def get_user_from_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        user_id  = payload.get("user_id")
        if not username or not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": username, "user_id": user_id}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

class CreateRoomBody(BaseModel):
    name: str

# FIX: Removed trailing slash and fixed redundant logic
@router.post("")
async def create_room_route(
    body: CreateRoomBody,
    user: dict = Depends(get_user_from_token)
):
    # Create the room
    room = await create_room(body.name, user["user_id"], user["username"])
    room_id = str(room.id)
    
    # Add the owner as the first member
    await add_member(room_id, user["user_id"], user["username"])

    return {
        "room_id": room_id,
        "name": room.name,
        "display_name": user["username"],
        "join_link": f"/room/{room_id}"
    }

@router.get("/{room_id}/members")
async def get_room_members(
    room_id: str,
    user: dict = Depends(get_user_from_token)
):
    members = await get_members(room_id)
    return {"members": members}

@router.post("/{room_id}/join")
async def join_room(
    room_id: str,
    user: dict = Depends(get_user_from_token)
):
    room = await get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not room.is_active:
        raise HTTPException(status_code=400, detail="Room is no longer active")

    count = await get_member_count(room_id)
    if count >= room.max_capacity:
        raise HTTPException(status_code=400, detail="Room is full")

    already = await is_member(room_id, user["user_id"])
    if not already:
        await add_member(room_id, user["user_id"], user["username"])

    return {
        "room_id": room_id,
        "display_name": user["username"]
    }

@router.get("/{room_id}")
async def get_room_info(
    room_id: str,
    user: dict = Depends(get_user_from_token)
):
    room = await get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "room_id": str(room.id),
        "name": room.name,
        "owner_id": str(room.owner_id),
        "owner_username": room.owner_username,
        "is_active": room.is_active,
        "capacity": room.max_capacity,
        "member_count": room.member_count
    }

@router.delete("/{room_id}/kick/{target_user_id}")
async def kick_user(
    room_id: str,
    target_user_id: str,
    user: dict = Depends(get_user_from_token)
):
    room = await get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if str(room.owner_id) != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the owner can kick users")
    
    await remove_member(room_id, target_user_id)
    await publish(room_id, json.dumps({
        "type": "kick",
        "user_id": target_user_id
    }).encode())
    return {"message": "User kicked"}

@router.delete("/{room_id}")
async def close_room(
    room_id: str,
    user: dict = Depends(get_user_from_token)
):
    room = await get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if str(room.owner_id) != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the owner can close the room")

    await set_room_inactive(room_id)
    await publish(room_id, json.dumps({"type": "room_closing"}).encode())
    return {"message": "Room closed"}