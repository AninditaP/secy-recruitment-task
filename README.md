# Secy Recruitment Task - Canvas System

## 1. Environment Variables
Create the following `.env` files:

### backend/servers/Auth/.env
SECRET_KEY="your secret key"
DATABASE_URL=postgresql://postgres:my_local_secure_password@db:5432/postgres
CANVAS_DATABASE_URL=postgresql://picasso:picasso123@postgres_canvas:5432/canvas_db

### backend/servers/server1/.env
CANVAS_DATABASE_URL=postgresql://picasso:picasso123@postgres_canvas:5432/canvas_db
SECRET_KEY="your secret key"
REDIS_URL=redis://redis:6379
SERVER_ID=server1
PORT=8001
OWNER_ABSENCE_TIMEOUT=300

### backend/servers/server2/.env
CANVAS_DATABASE_URL=postgresql://picasso:picasso123@postgres_canvas:5432/canvas_db
SECRET_KEY="your secret key"
REDIS_URL=redis://redis:6379
SERVER_ID=server2
PORT=8002
OWNER_ABSENCE_TIMEOUT=300

### frontend/.env
NEXT_PUBLIC_AUTH_URL=http://localhost:8080/auth

## 2. Backend Setup
Run from the root directory:
docker compose up --build

## 3. Frontend Setup
In a new terminal, navigate to the frontend folder:
cd frontend
npm install
npm run dev

The application will be available at http://localhost:3000/Auth/login.
