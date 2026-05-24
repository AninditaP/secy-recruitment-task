from sqlalchemy import create_engine, String, Column, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import os
import uuid


DB_PATH = os.getenv("DATABASE_URL")
engine = create_engine(DB_PATH)
Base=declarative_base()

class User(Base):
    __tablename__ = "users"
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

def init_db():
    Base.metadata.create_all(engine)

def get_user(username: str):
    with Session(engine) as session:
        return session.query(User).filter(User.username == username).first()

def create_user(username: str, hashed_password: str):
    with Session(engine) as session:
        new_user = User(username=username, hashed_password=hashed_password)
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        return new_user