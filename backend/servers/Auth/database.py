import psycopg2
import psycopg2.extras
from fastapi import HTTPException
from typing import Optional
from psycopg2.errors import UniqueViolation
import os
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DATABASE_URL")

def get_conn():
    return psycopg2.connect(DB_PATH)

def init_db():
    conn = None
    try:
        conn = get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        username TEXT PRIMARY KEY,
                        hashed_password TEXT NOT NULL,
                        full_name TEXT
                    )
                """)
    finally:
        if conn:
            conn.close()

def get_user(username: str) -> Optional[dict]:
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT username, hashed_password, full_name FROM users WHERE username = %s",
            (username,)
        )
        row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def create_user(username: str, hashed_password: str, full_name: str = ""):
    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, hashed_password, full_name) VALUES (%s, %s, %s)",
                    (username, hashed_password, full_name)
                )
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Username already taken")
    finally:
        conn.close()