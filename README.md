# FightForge

MMA training and nutrition platform — **React** (Vite) frontend, **Node.js + Express** API, and **MySQL**, with role-based access for athletes, coaches, and admins.

## Quick start (easiest way to try it)

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose).

From the repo root:

```bash
docker compose up --build
```

Wait until the frontend is listening, then open **http://127.0.0.1:5173** .

- The stack brings up **MySQL**, the **API** (port **5000**), and the **Vite dev server** (port **5173**).
- Sample users are created automatically (`backend/scripts/seed.js` runs on each backend start; safe to repeat).
- On this compose setup, **demo account buttons** are enabled on Login/Home. Use any sample email with password **`Password123!`**:
  - `admin@fightforge.test` — admin  
  - `coach@fightforge.test` — coach  
  - `athlete@fightforge.test` — athlete  

Stop: `docker compose down`. Wipe the database and start clean: `docker compose down -v` then `docker compose up --build` again.

For production deployment (separate hosts, env vars, CORS), see **[`docs/DEPLOY.md`](docs/DEPLOY.md)**.

## Maintainers

- **Craig Omozeje** — Backend, database, auth, workouts, progress, friends, messaging, and most of the React UI.
- **Tucker Ambrose** — Team member.

## Prerequisites (manual / non-Docker setup)

- Node.js 20+ recommended  
- MySQL 8.x (or compatible) with a user that can create the `fightforge` database

## Database setup (manual)

From the repo root:

```bash
mysql -u root -p < backend/database/schema.sql
```

Copy `backend/.env.example` to `backend/.env` and set `DB_*`, `JWT_SECRET`, and (for production) `CORS_ORIGIN`.

### Optional: sample users (manual install)

After the schema exists:

```bash
cd backend
npm install
npm run seed
```

Same accounts and password **`Password123!`** as in Docker quick start above.

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

Open the Vite URL (usually `http://127.0.0.1:5173`). The dev server proxies `/api` to the backend (`VITE_PROXY_TARGET` in `frontend/.env`). Set `VITE_SHOW_DEMO_ACCOUNTS=true` in `frontend/.env` if you want the sample-account quick-fill on Login.

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

See **[`docs/DEPLOY.md`](docs/DEPLOY.md)** for deploying MySQL, the API, the SPA (e.g. Vercel), environment variables, and CORS — with any host you choose.

**Frontend on Vercel:** set **Root Directory** to **`frontend`**. Point the app at your API with **`VITE_API_BASE`**, or **`API_ORIGIN_FALLBACK`** in `frontend/src/api/client.js`, or an **`/api` rewrite** in `frontend/vercel.json` — see **[`docs/VERCEL.md`](docs/VERCEL.md)**.
