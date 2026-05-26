# TECHIE PICASSO 

---

## Architecture

- **Frontend** — Next.js 16 with tldraw for the collaborative canvas
- **Auth Service** — FastAPI on port 8003, handles authentication and room management
- **Server1 / Server2** — FastAPI WebSocket servers on ports 8001/8002, handle canvas sync and control messaging
- **nginx** — Reverse proxy on port 8080, routes WebSocket traffic to canvas servers
- **PostgreSQL (db)** — Stores users and room metadata
- **PostgreSQL (postgres_canvas)** — Stores canvas snapshots and room members
- **Redis** — Pub/sub for cross-server WebSocket message broadcasting


## Setup

### 1. Environment Variables

Create the following `.env` files before starting the application.

**`backend/servers/Auth/.env`**
```env
SECRET_KEY="your secret key"
DATABASE_URL=postgresql://postgres:my_local_secure_password@db:5432/postgres
CANVAS_DATABASE_URL=postgresql://picasso:picasso123@postgres_canvas:5432/canvas_db
```

**`backend/servers/server1/.env`**
```env
CANVAS_DATABASE_URL=postgresql://picasso:picasso123@postgres_canvas:5432/canvas_db
SECRET_KEY="your secret key"
REDIS_URL=redis://redis:6379
SERVER_ID=server1
PORT=8001
OWNER_ABSENCE_TIMEOUT=300
```

**`backend/servers/server2/.env`**
```env
CANVAS_DATABASE_URL=postgresql://picasso:picasso123@postgres_canvas:5432/canvas_db
SECRET_KEY="your secret key"
REDIS_URL=redis://redis:6379
SERVER_ID=server2
PORT=8002
OWNER_ABSENCE_TIMEOUT=300
```

**`frontend/.env`**
```env
NEXT_PUBLIC_AUTH_URL=http://localhost:8003
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

---

### 2. Start the Backend

From the project root directory:

```bash
docker compose up --build
```

---

### 3. Start the Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

---

## Usage

Open [http://localhost:3000/Auth/login]


## Service Ports

| Service | Port |
|---|---|
| Frontend (Next.js) | 3000 |
| nginx (WebSocket proxy) | 8080 |
| Auth API | 8003 |
| Canvas Server 1 | 8001 |
| Canvas Server 2 | 8002 |
| PostgreSQL (auth) | 5432 |
| PostgreSQL (canvas) | 5433 |
| Redis | 6379 |

---

## Stopping the Application

```bash
docker compose down
```

To also remove all stored data (databases):

```bash
docker compose down -v
```