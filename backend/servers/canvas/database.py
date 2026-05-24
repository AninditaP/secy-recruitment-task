import os
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, Boolean, Integer, DateTime, LargeBinary, delete, update, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

DATABASE_URL = os.getenv("CANVAS_DATABASE_URL").replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

class Room(Base):
    __tablename__ = "rooms"
    id:             Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name:           Mapped[str]       = mapped_column(String, nullable=False)
    owner_id:       Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    owner_username: Mapped[str]       = mapped_column(String, nullable=False)
    capacity:       Mapped[int]       = mapped_column(Integer, nullable=False)
    is_active:      Mapped[bool]      = mapped_column(Boolean, default=True)
    created_at:     Mapped[datetime]  = mapped_column(DateTime, server_default=func.now())


class RoomMember(Base):
    __tablename__ = "room_members"
    room_id:      Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True)
    user_id:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    username:     Mapped[str]       = mapped_column(String, nullable=False)
    joined_at:    Mapped[datetime]  = mapped_column(DateTime, server_default=func.now())


class CanvasSnapshot(Base):
    __tablename__ = "canvas_snapshots"
    room_id:    Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True)
    data:       Mapped[bytes]     = mapped_column(LargeBinary, nullable=False)
    updated_at: Mapped[datetime]  = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)



async def create_room(name: str, owner_id: str, owner_username: str, capacity: int):
    async with AsyncSessionLocal() as session:
        room = Room(
            name=name,
            owner_id=uuid.UUID(owner_id),
            owner_username=owner_username,
            capacity=capacity
        )
        session.add(room)
        await session.flush()

        member = RoomMember(
            room_id=room.id,
            user_id=uuid.UUID(owner_id),
            username=owner_username
        )
        session.add(member)
        await session.commit()
        await session.refresh(room)
        return room


async def get_room(room_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Room).where(Room.id == uuid.UUID(room_id))
        )
        return result.scalar_one_or_none()


async def set_room_inactive(room_id: str):
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(Room).where(Room.id == uuid.UUID(room_id)).values(is_active=False)
        )
        await session.commit()



async def add_member(room_id: str, user_id: str, username: str):
    """
    Adds user to room using their actual user_id from JWT.
    ON CONFLICT DO NOTHING — safe to call if already a member.
    """
    async with AsyncSessionLocal() as session:
        member = RoomMember(
            room_id=uuid.UUID(room_id),
            user_id=uuid.UUID(user_id),
            username=username
        )
        session.add(member)
        await session.commit()


async def remove_member(room_id: str, user_id: str):
    """Removes member by user_id. Called on disconnect or leave."""
    async with AsyncSessionLocal() as session:
        await session.execute(
            delete(RoomMember).where(
                RoomMember.room_id == uuid.UUID(room_id),
                RoomMember.user_id == uuid.UUID(user_id)
            )
        )
        await session.commit()


async def get_member_count(room_id: str) -> int:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(func.count()).select_from(RoomMember).where(
                RoomMember.room_id == uuid.UUID(room_id)
            )
        )
        return result.scalar()


async def get_members(room_id: str):
    """Returns all members with user_id and username. Sent to frontend for participant list."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(RoomMember).where(RoomMember.room_id == uuid.UUID(room_id))
        )
        members = result.scalars().all()
        return [
            {
                "user_id": str(m.user_id),
                "username": m.username,
            }
            for m in members
        ]


async def is_member(room_id: str, user_id: str) -> bool:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(RoomMember).where(
                RoomMember.room_id == uuid.UUID(room_id),
                RoomMember.user_id == uuid.UUID(user_id)
            )
        )
        return result.scalar_one_or_none() is not None


async def get_snapshot(room_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(CanvasSnapshot).where(CanvasSnapshot.room_id == uuid.UUID(room_id))
        )
        snapshot = result.scalar_one_or_none()
        return bytes(snapshot.data) if snapshot else None


async def upsert_snapshot(room_id: str, data: bytes):
    async with AsyncSessionLocal() as session:
        stmt = insert(CanvasSnapshot).values(
            room_id=uuid.UUID(room_id),
            data=data
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["room_id"],
            set_={"data": stmt.excluded.data, "updated_at": func.now()}
        )
        await session.execute(stmt)
        await session.commit()