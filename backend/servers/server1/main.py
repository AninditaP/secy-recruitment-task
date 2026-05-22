import os
import socket
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
 
SERVER_ID = os.getenv("SERVER_ID", "server1")
PORT = int(os.getenv("PORT", 8001))
HOST = socket.gethostname()
 
app = FastAPI(title=f"Server {SERVER_ID}", version="1.0.0")
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
 
@app.get("/")
def root():
    return {
        "message": f"Hello from {SERVER_ID}",
        "server": SERVER_ID,
        "host": HOST,
    }
 
 
@app.get("/health")
def health():
    return {"status": "ok", "server": SERVER_ID}
 
 
@app.get("/info")
def info():
    return {
        "server": SERVER_ID,
        "host": HOST,
        "port": PORT,
        "description": f"FastAPI backend {SERVER_ID}",
    }
 