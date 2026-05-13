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

## Option A — Import whole repo (recommended)

This repo includes a root **`vercel.json`** that builds `frontend/` and publishes `frontend/dist`.

1. Go to [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** your FightForge repository.
3. **Root Directory** — leave as **`.`** (repository root). Vercel will use the root `vercel.json`.
4. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value | Environments |
   |------|--------|----------------|
   | `VITE_API_BASE` | `https://your-api-host.example.com` | Production, Preview |
   | `VITE_SHOW_DEMO_ACCOUNTS` | `false` | Production (optional on Preview for testing) |

5. **Deploy**. After the first deploy, copy your **`.vercel.app`** URL and add it to the backend `CORS_ORIGIN`, then redeploy the API.

---

## Option B — Root directory `frontend`

If you prefer Vercel’s **Root Directory** = `frontend`:

1. Set **Root Directory** to `frontend` in the project settings.
2. Use **`frontend/vercel.json`** (already in the repo). You can **ignore** or remove the root `vercel.json` for that project to avoid confusion.
3. Set the same **`VITE_API_BASE`** (and optional `VITE_SHOW_DEMO_ACCOUNTS`) in the project env vars.

---

## CLI (optional)

```bash
npm i -g vercel
cd c:\path\to\al-4-1
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
| Blank page on `/login` or refresh | SPA rewrites: root `vercel.json` or `frontend/vercel.json` should rewrite non-file routes to `/index.html`. |
| `NetworkError` / failed fetch | Set `VITE_API_BASE` to the real API origin; redeploy after changing env (Vite bakes env at **build** time). |
| CORS blocked | Add your Vercel URL to backend `CORS_ORIGIN` (comma-separated if multiple). |

Full stack (DB + API + env) walkthrough: **[DEPLOY.md](DEPLOY.md)**.
