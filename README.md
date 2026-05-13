# FightForge

MMA training and nutrition platform — **React** (Vite) frontend, **Node.js + Express** API, and **MySQL**, with role-based access for athletes, coaches, and admins.

## Maintainers

- **Craig Omozeje** — Backend, database, auth, workouts, progress, friends, messaging, and most of the React UI.
- **Tucker Ambrose** — Team member.

## Prerequisites

- Node.js 20+ recommended  
- MySQL 8.x (or compatible) with a user that can create the `fightforge` database

## Database setup

From the repo root:

```bash
mysql -u root -p < backend/database/schema.sql
```

Copy `backend/.env.example` to `backend/.env` and set `DB_*`, `JWT_SECRET`, and (for production) `CORS_ORIGIN`.

### Optional: sample users for local development

After the schema exists, you can load **optional sample accounts** (same password for all three):

```bash
cd backend
npm install
npm run seed
```

Sample logins (change or remove these in production; use real signup instead):

- `admin@fightforge.test` — admin  
- `coach@fightforge.test` — coach  
- `athlete@fightforge.test` — athlete (linked to the sample coach)

## Run with Docker

With Docker Desktop:

```bash
docker compose up --build
```

- MySQL is initialized from `backend/database/schema.sql` on first run.
- The backend runs `scripts/seed.js` once on each container start (idempotent) so sample data and library rows exist for local testing.
- Frontend: <http://127.0.0.1:5173>  
- API health: <http://127.0.0.1:5000/api/health>

Stop: `docker compose down`. Wipe the database volume: `docker compose down -v`.

Default compose values are for **local development only**. For production, set strong secrets, `NODE_ENV=production`, and your real frontend origin in `CORS_ORIGIN` (see [`docs/DEPLOY.md`](docs/DEPLOY.md)).

## Run locally (without Docker)

**Terminal 1 — API**

```bash
cd backend
npm install
npm start
```

API defaults to `http://127.0.0.1:5000` (`GET /api/health`).

**Terminal 2 — Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (usually `http://127.0.0.1:5173`). The dev server proxies `/api` to the backend (`VITE_PROXY_TARGET` in `frontend/.env`).

## API overview

| Area        | Base path        |
|------------|------------------|
| Auth       | `/api/auth`      |
| Users      | `/api/users`     |
| Workouts   | `/api/workouts`  |
| Meals      | `/api/meals`     |
| Progress   | `/api/progress`  |
| Messages   | `/api/messages`  |
| Friends    | `/api/friends`   |

## Deployment

See **[`docs/DEPLOY.md`](docs/DEPLOY.md)** for Vercel + Railway (or similar): MySQL, API, SPA, environment variables, and CORS.

**Frontend-only on Vercel:** step-by-step is in **[`docs/VERCEL.md`](docs/VERCEL.md)** (env vars, root vs `frontend/` directory, troubleshooting).
