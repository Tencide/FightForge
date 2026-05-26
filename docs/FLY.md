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

1. Install the Fly CLI: [Install flyctl](https://fly.io/docs/hands-on/install-flyctl/). On Windows it lands in **`%USERPROFILE%\.fly\bin`** — add that folder to your **PATH**, then open a **new** terminal. Use the **`flyctl`** command (or full path `"%USERPROFILE%\.fly\bin\flyctl.exe"`). If `fly` is “not recognized”, PATH was not updated yet.
2. Sign up / log in: `flyctl auth login`.
3. A **MySQL 8+** database with schema applied (`backend/database/schema.sql` or `schema.single_mysql_database.sql`).
4. A strong **`JWT_SECRET`** (e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

### Billing (before first `apps create` / `deploy`)

Fly often requires a **card on file** or **prepaid credit** before it will create or run apps — even if you stay inside free allowances. Add billing from the link Fly prints (e.g. **`https://fly.io/dashboard/…/billing`**) or **[Fly billing docs](https://fly.io/docs/about/pricing/)**.

Until billing succeeds:

- **`flyctl apps create …`** may fail → **no app** is created.
- **`flyctl deploy`** then errors with **`app not found`** because nothing was registered.

Fix billing first, then **`apps create`** again, then **`deploy`**.

---

**Windows:** use **`flyctl`** for every command below (`flyctl launch`, `flyctl deploy`, …) if **`fly`** is not recognized — see Prerequisites.

## 1. Create the app from `backend/`

### If `flyctl launch` fails with **`region  not found`** (common on Windows)

Do **not** rely on `fly launch`. The repo **`fly.toml`** omits **`primary_region`** on purpose so nothing merges to an empty region.

From **`backend/`**:

```bash
flyctl apps create fightforge-api --save -y
flyctl deploy --primary-region iad
```

- Change **`fightforge-api`** if that name is taken (`fly.toml` → **`app`** must match).
- Or run the helper: **`pwsh -File scripts/fly-first-deploy.ps1`**

If **`apps create`** says the app already exists, skip it and run only **`flyctl deploy --primary-region iad`**.

### Optional: `flyctl launch`

Only if you want the interactive wizard **and** your **`flyctl`** version works:

```bash
cd backend
flyctl launch --region iad -y
```

If you still see **`region  not found`**, use the **`apps create` + `deploy`** steps above.

### PowerShell tip

If your prompt shows **`>>`** after typing a command, you are in a **continuation** (unfinished string). Press **`Ctrl+C`**, then run **`flyctl`** again on **one line**.

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

**iOS app (Capacitor):** add WebView origins, e.g.  
`CORS_ORIGIN="https://your-app.vercel.app,capacitor://localhost,ionic://localhost"`  
See **[`APPLE_APP_STORE.md`](APPLE_APP_STORE.md)**.

---

## 3. Deploy

After the first **`deploy --primary-region iad`**, later updates are usually:

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
| **`We need your payment information`** | Add a card or credit in **[Fly billing](https://fly.io/dashboard)** (exact URL is in the error). Retry **`apps create`** then **`deploy`**. |
| **`app not found`** | Usually the app was **never created** (billing blocked **`apps create`**, or wrong **`app`** name vs **`fly.toml`**). Run **`flyctl apps list`**. If missing, **`flyctl apps create fightforge-api --save -y`** after billing works. |
| **JWT_SECRET must be set** | Backend refuses prod boot without a real secret — `fly secrets set JWT_SECRET=...` |
| **MySQL connection errors** | Host allows Fly’s outbound IPs; correct **`DB_HOST`** / firewall / SSL mode if your provider requires TLS (may need code/config beyond `.env`). |
| **CORS / login fails from Vercel** | **`CORS_ORIGIN`** exactly matches the browser origin (`https://your-project.vercel.app`). |

General deployment flow: **[`DEPLOY.md`](DEPLOY.md)**.
