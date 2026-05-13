# Deploy the FightForge frontend on Vercel

Vercel hosts the **React (Vite) SPA** only. The **Express API** and **MySQL** must run elsewhere (e.g. [Railway](DEPLOY.md) + managed MySQL). The browser calls your API using `VITE_API_BASE`.

---

## Prerequisites

1. Repo pushed to **GitHub** (or GitLab / Bitbucket — Vercel supports those too).
2. A **public HTTPS URL** for your API, e.g. `https://fightforge-api.up.railway.app`  
   - No trailing slash (the app normalizes this, but keep it clean).
3. Backend **`CORS_ORIGIN`** includes your Vercel URL(s), e.g.  
   `https://your-app.vercel.app`  
   Add both preview and production URLs if you use preview deployments.

---

## Configure the Vercel project (required)

Vercel must use the **`frontend`** folder as the project root. There is **no** `vercel.json` at the repository root — config lives in **`frontend/vercel.json`**.

1. Go to [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** your FightForge repository.
3. **Root Directory** → click **Edit** and set it to **`frontend`** (not `.` and not empty if Vercel guessed wrong).
4. Confirm **Framework Preset** is **Vite**, **Build Command** `npm run build`, **Output Directory** `dist` (defaults match `frontend/vercel.json`).
5. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value | Environments |
   |------|--------|----------------|
   | `VITE_API_BASE` | `https://your-api-host.example.com` | Production, Preview |
   | `VITE_SHOW_DEMO_ACCOUNTS` | `false` | Production (optional on Preview for testing) |

6. **Deploy**. After the first deploy, copy your **`.vercel.app`** URL and add it to the backend `CORS_ORIGIN`, then redeploy the API.

### Why not repository root (`.`)?

If **Root Directory** is left as **`.`**, Vercel runs install/build at the repo root where there is **no** `package.json`, and/or an old root `vercel.json` could run `cd frontend`, which **fails** when Vercel has already changed the working directory to `frontend`. Always set **Root Directory = `frontend`**.

---

## CLI (optional)

```bash
npm i -g vercel
cd path/to/FightForge/frontend
vercel
```

Link the project, set env vars in the dashboard or `vercel env add VITE_API_BASE production`.

---

## Checklist after deploy

- [ ] `https://<vercel-app>/` loads the home page.
- [ ] **Sign up** or **Log in** triggers requests to `https://<api-host>/api/...` (check Network tab).
- [ ] No CORS errors — backend `CORS_ORIGIN` matches the exact browser origin (scheme + host + port).
- [ ] Production: `VITE_SHOW_DEMO_ACCOUNTS=false` so sample credentials are not advertised.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `cd frontend: No such file or directory` | **Root Directory** must be **`frontend`**, not `.`. Remove any custom Install Command that runs `cd frontend`. |
| Blank page on `/login` or refresh | `frontend/vercel.json` rewrites should send SPA routes to `/index.html`. |
| `NetworkError` / failed fetch | Set `VITE_API_BASE` to the real API origin; redeploy after changing env (Vite bakes env at **build** time). |
| CORS blocked | Add your Vercel URL to backend `CORS_ORIGIN` (comma-separated if multiple). |

Full stack (DB + API + env) walkthrough: **[DEPLOY.md](DEPLOY.md)**.
