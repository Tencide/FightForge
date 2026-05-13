# Deploy the FightForge API on Fly.io

This walks through hosting **`backend/`** (Express + Docker) on [Fly.io](https://fly.io). MySQL is **not** included — use managed MySQL elsewhere (PlanetScale, Aiven, RDS, etc.) that allows inbound connections from Fly’s egress IPs, or a VPN/private link.

---

## Where to host MySQL

Fly runs your API in their cloud; it connects to MySQL over the **public internet** (unless you wire a private network). You need **any MySQL 8+** host that gives you:

- hostname (e.g. `something.db.provider.com`)
- port (often **3306**)
- user / password
- a database name

**Typical places people put it:**

| Kind | Examples |
|------|-----------|
| Managed MySQL (easiest) | [Aiven MySQL](https://aiven.io/mysql), [DigitalOcean Managed Databases](https://www.digitalocean.com/products/managed-databases), [AWS RDS MySQL](https://aws.amazon.com/rds/mysql/), [Google Cloud SQL](https://cloud.google.com/sql/docs/mysql), [Azure Database for MySQL](https://azure.microsoft.com/products/mysql/) |
| App-platform add-ons | Many PaaS dashboards offer “MySQL” as an addon — create it there and copy **host / port / user / password** into Fly secrets as **`DB_*`**. |

**“Reachable from Fly”** means: from the internet, clients can open a TCP connection to that host on the DB port. In your provider’s firewall / IP allowlist, either allow **all** origins (simplest for learning) or follow their docs for **Fly.io egress** if they require IP allowlisting (Fly’s outbound IPs can change — managed DBs often use hostname + password only).

**Apply the schema** using:

- the provider’s **SQL / console / query** UI — paste **`backend/database/schema.sql`** *or* **`backend/database/schema.single_mysql_database.sql`** (use the second file if the provider already created **one** database for you and does not allow `CREATE DATABASE`; edit the first `USE …` line to match their DB name).

Put the same **`DB_HOST`**, **`DB_PORT`**, **`DB_USER`**, **`DB_PASSWORD`**, **`DB_NAME`** into Fly (`fly secrets set …`) as in the section below.

---

## Prerequisites

1. Install the Fly CLI: [Install flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. Sign up / log in: `fly auth login`.
3. A **MySQL 8+** database with schema applied (`backend/database/schema.sql` or `schema.single_mysql_database.sql`).
4. A strong **`JWT_SECRET`** (e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

---

## 1. Create the app from `backend/`

If the name `fightforge-api` in **`fly.toml`** is already taken on Fly, change the `app = '...'` line to something unique, or run `fly launch` and let it set the name.

```bash
cd backend
fly launch
```

- Choose an **app name** (globally unique), region (e.g. `iad`), 
- Confirm **Dockerfile** build,
- **Do not deploy yet** if you still need to set secrets — or deploy and fix secrets next.

The repo includes **`fly.toml`** with **`internal_port = 5000`** (matches `Dockerfile` `EXPOSE 5000` and `server.js`). If `fly launch` generated another port, set **`internal_port`** to **`5000`** or set **`PORT=5000`** in Fly secrets so it matches.

---

## 2. Set secrets (environment variables)

**Option A — script (Windows, after you create `backend/.env.fly`):** copy **`backend/.env.fly.example`** to **`backend/.env.fly`**, edit values, then from **`backend/`**:

```powershell
pwsh -File scripts/apply-fly-secrets.ps1
```

**Option B — by hand** (any OS):

Secrets are encrypted at rest; use them for passwords and JWT.

```bash
fly secrets set NODE_ENV=production
fly secrets set PORT=5000
fly secrets set DB_HOST="your-mysql-host.example.com"
fly secrets set DB_PORT="3306"
fly secrets set DB_USER="your_user"
fly secrets set DB_PASSWORD="your_mysql_password"
fly secrets set DB_NAME="fightforge"
fly secrets set JWT_SECRET="paste-a-long-random-hex-string"
```

**`CORS_ORIGIN`:** set after you have your Vercel URL (or use a temporary `https://localhost:5173` only for testing — not for real users).

```bash
fly secrets set CORS_ORIGIN="https://your-app.vercel.app"
```

You can list multiple origins separated by commas. After changing secrets, the app restarts.

---

## 3. Deploy

```bash
fly deploy
```

Optional — seed demo users (same as local `npm run seed`):

```bash
fly ssh console
# inside the machine:
node scripts/seed.js
exit
```

Watch logs until the machine is healthy:

```bash
fly logs
```

---

## 4. Get your public API URL (this is your `VITE_API_BASE` origin)

Default Fly hostname:

```text
https://<your-app-name>.fly.dev
```

Test:

```text
https://<your-app-name>.fly.dev/api/health
```

You should see: `{"ok":true,"service":"fightforge-api"}`.

**`VITE_API_BASE` on Vercel** = that origin only, e.g. `https://my-fightforge-api.fly.dev` (no `/api`).

---

## 5. Connect the Vercel frontend

1. In Vercel → **Environment variables** → set **`VITE_API_BASE`** = `https://<your-app-name>.fly.dev` for **Production** and **Preview**.
2. Redeploy the frontend.
3. On Fly, set **`CORS_ORIGIN`** to your real `https://….vercel.app` origin(s) and `fly deploy` (or rely on secret update auto-restart).

Details: **[`VERCEL.md`](VERCEL.md)**.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| **503 / connection refused** | `fly logs` — crash loop? DB unreachable? |
| **JWT_SECRET must be set** | Backend refuses prod boot without a real secret — `fly secrets set JWT_SECRET=...` |
| **MySQL connection errors** | Host allows Fly’s outbound IPs; correct **`DB_HOST`** / firewall / SSL mode if your provider requires TLS (may need code/config beyond `.env`). |
| **CORS / login fails from Vercel** | **`CORS_ORIGIN`** exactly matches the browser origin (`https://your-project.vercel.app`). |

General deployment flow: **[`DEPLOY.md`](DEPLOY.md)**.
