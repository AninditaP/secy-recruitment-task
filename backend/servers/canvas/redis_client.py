from redis.asyncio import Redis, from_url
import os

_redis: Redis | None = None

async def init_redis():
    global _redis
    _redis = from_url(
        os.getenv("REDIS_URL", "redis://redis:6379"),
        decode_responses=False
    )

async def close_redis():
    if _redis:
        await _redis.aclose()

def get_redis() -> Redis:
    return _redis

async def publish(room_id: str, data: bytes):
    await _redis.publish(f"room:{room_id}", data)