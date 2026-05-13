# Deploying FightForge

The app is three pieces. They go in three different places.

| Piece | What it is | Typical host |
| --- | --- | --- |
| `frontend/` | Vite + React SPA | **Vercel**, Netlify, Cloudflare Pages, or any static host |
| `backend/` | Long-running Express API | **Render**, **Fly.io**, a **VPS**, **Docker** on a VM, **AWS ECS**, etc. |
| MySQL | Database | **PlanetScale**, **Aiven**, **AWS RDS**, the same VPS as Docker, or any MySQL 8+ |

The frontend does **not** run the API or the database; it only talks to your API over HTTPS.

---

## 1. MySQL

1. Create a MySQL 8+ instance and a **database** (name it e.g. `fightforge`, or note whatever name your provider assigns).
2. Apply the schema:
   - **Fresh database you control:** run `backend/database/schema.sql` (creates the `fightforge` database) **or** run `backend/database/schema.single_mysql_database.sql` after changing the first `USE …` line to your database name.
3. Connect with any client (CLI, DBeaver, TablePlus, or a host’s “SQL” UI). Paste the file, execute.

> Optional: `cd backend && npm run seed` inserts sample users and library rows (idempotent).

---

## 2. Deploy the API (Express + `backend/`)

Use any host that can run **Node 20+** and reach MySQL (public host/port + user/password, or private network).

**Docker:** the repo includes `backend/Dockerfile` (`CMD ["node", "server.js"]`). Point your platform at **`backend/`** as the build context.

**Environment variables** (names are always the same; how you set them depends on the host):

| Name | Value |
|------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` (or the port your host injects; read `process.env.PORT` in code already) |
| `DB_HOST` | MySQL hostname |
| `DB_PORT` | MySQL port (often `3306`) |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (must match the `USE` / schema you applied) |
| `JWT_SECRET` | Long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `CORS_ORIGIN` | Your frontend origin(s), e.g. `https://your-app.vercel.app` (comma-separated for multiple) |

**Raw `.env` style** (copy into a host “environment” or “secrets” editor):

```env
NODE_ENV=production
PORT=5000
DB_HOST=your-mysql-host.example.com
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=fightforge
JWT_SECRET=PASTE_JWT_SECRET
CORS_ORIGIN=https://YOUR-FRONTEND.example.com
```

Assign a **public HTTPS URL** to the service (platform “domain” / “URL” / reverse proxy). Test:

`https://<your-api-host>/api/health` → `{"ok":true,"service":"fightforge-api"}`

---

## 3. Deploy the frontend (Vercel)

**Root Directory** must be **`frontend`** (see **[`VERCEL.md`](VERCEL.md)**).

| Name | Value |
|------|--------|
| `VITE_API_BASE` | `https://<your-api-host>` — **origin only**, no `/api` suffix |
| `VITE_SHOW_DEMO_ACCOUNTS` | `false` for public sites |

Set `VITE_API_BASE` for **Production** and **Preview** if you use preview deployments. Redeploy after env changes.

**Example `.env` style:**

```env
VITE_API_BASE=https://api.yourdomain.com
VITE_SHOW_DEMO_ACCOUNTS=false
```

Then set **`CORS_ORIGIN`** on the API to your real Vercel URL(s) and redeploy the API.

---

## Common pitfalls

- **CORS in the browser.** `CORS_ORIGIN` on the API must list the exact frontend origin (`https://…`).
- **`Server error during login`.** API cannot reach MySQL — check `DB_*` and network/firewall.
- **SPA 404 on refresh.** Ensure `frontend/vercel.json` (or your host’s equivalent) routes non-file paths to `index.html`.
- **`JWT_SECRET` changed.** All existing JWTs invalidate; users log in again.

---

## Same host for frontend + API

You can serve the built SPA (`frontend/dist`) and the API from one machine or one PaaS project (e.g. Express `express.static` for `dist`, or two processes behind nginx). Then you may use a **same-origin** `/api` path and skip `VITE_API_BASE`. This repo’s default is still **Vercel + separate API** for a simple CDN static setup.
