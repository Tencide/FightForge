# FightForge

MMA training and nutrition platform — **React** (Vite) frontend, **Node.js + Express** API, and **MySQL**, with role-based access for athletes, coaches, and admins.

**One link for people’s phones (any network, HTTPS):** see **[`docs/SHARE_LINK.md`](docs/SHARE_LINK.md)** — deploy for a stable URL (e.g. **Vercel** + API per **[`docs/VERCEL.md`](docs/VERCEL.md)** / **[`docs/DEPLOY.md`](docs/DEPLOY.md)**), or use a tunnel for a quick shareable link while your PC runs Docker.

## Quick start (easiest way to try it)

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose).

From the repo root:

```bash
docker compose up --build
```

Wait until the frontend is listening.

- **On this machine:** open **http://127.0.0.1:5173** (or **http://localhost:5173**).
- The stack brings up **MySQL**, the **API** (port **5000**), and the **Vite dev server** (port **5173**). The dev server listens on **all interfaces** (`0.0.0.0`), so other devices can reach it if your network and firewall allow it.
- Sample users are created automatically (`backend/scripts/seed.js` runs on each backend start; safe to repeat).
- On this compose setup, **demo account buttons** are enabled on Login/Home. Use any sample email with password **`Password123!`**:
  - `admin@fightforge.test` — admin  
  - `coach@fightforge.test` — coach  
  - `athlete@fightforge.test` — athlete  

Stop: `docker compose down`. Wipe the database and start clean: `docker compose down -v` then `docker compose up --build` again.

### Same Wi-Fi: phones, tablets, or another computer

`127.0.0.1` always means “this device only.” For teammates on **another** phone or laptop:

1. Keep `docker compose up` running on the host that has the repo.
2. On that host, find its **LAN IPv4** (same network everyone will use):
   - **Windows:** `ipconfig` → your active adapter (Wi-Fi or Ethernet) → **IPv4 Address** (often `192.168.x.x` or `10.x.x.x`).
   - **macOS:** System Settings → Network → Wi-Fi/Ethernet → IP address.
   - **Linux:** `hostname -I` or your distro’s network panel.
3. On the other device (connected to the **same** Wi-Fi or LAN), open **`http://<that-ip>:5173`** — for example `http://192.168.1.42:5173`.
4. If the page never loads, the host’s **firewall** is usually blocking Docker’s published port **5173**. Allow inbound TCP **5173** for **Private** networks (Windows: Defender Firewall → allow an app → **Docker Desktop** / **wslhost**, or an inbound rule for port 5173). macOS: System Settings → Network → Firewall → options for Docker.

The API is still reached through the Vite **proxy** (`/api` → backend), so testers do **not** need to open port 5000 on the phone’s browser for normal use.

### Remote testers (different building / VPN / internet)

**→ Use [`docs/SHARE_LINK.md`](docs/SHARE_LINK.md):** one **HTTPS** URL to text people (deploy once, or a tunnel like ngrok while Docker runs on your PC). Same-Wi-Fi `http://192.168…` is not enough for phones on cellular or other cities.

For production-style hosting details, see **[`docs/DEPLOY.md`](docs/DEPLOY.md)**.

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

Open the Vite URL (usually `http://127.0.0.1:5173`). The dev server proxies `/api` to the backend (`VITE_PROXY_TARGET` in `frontend/.env`). Set `VITE_SHOW_DEMO_ACCOUNTS=true` in `frontend/.env` if you want the sample-account quick-fill on Login. The Vite config uses **`host: true`**, so other devices on the same Wi-Fi can open **`http://<your-computer-LAN-IP>:5173`** (see the Docker “Same Wi-Fi” section above for finding the IP and firewall tips).

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

- **Frontend (Vercel):** **[`docs/VERCEL.md`](docs/VERCEL.md)** — Root **`frontend`**, **`VITE_API_BASE`** (Production + Preview). **[`frontend/.env.vercel.example`](frontend/.env.vercel.example)**  
- **API (Fly.io):** **[`docs/FLY.md`](docs/FLY.md)** — Docker app, secrets, **`https://<app>.fly.dev`** → that origin is **`VITE_API_BASE`**.  
- **Overview (MySQL + CORS):** **[`docs/DEPLOY.md`](docs/DEPLOY.md)**
