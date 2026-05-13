# Deploying FightForge

The app is three pieces. They go in three different places.

| Piece | What it is | Recommended host |
| --- | --- | --- |
| `frontend/` | Vite + React SPA | **Vercel** (free, auto-deploy from GitHub) |
| `backend/` | Long-running Express API | **Railway** or **Render** (free tier OK) |
| MySQL | Database | **Railway** add-on or **PlanetScale / Aiven** |

Vercel is the right home for the frontend only. It will not host the Express
server or the database.

---

## 1. Deploy the database

The simplest path is to spin up a managed MySQL on the same platform you'll
use for the backend (so they share a private network and you pay one bill).

### Railway

1. Sign in at <https://railway.app> with GitHub.
2. **New Project** → **Provision MySQL**.
3. Once it's running, click the MySQL service → **Variables** tab. Copy:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE` (default: `railway` — change to `fightforge` in the
     **Settings** tab if you like).
4. Apply the schema. Open the MySQL service → **Data** tab → **Query** and
   paste the contents of `backend/database/schema.sql`. Run it.
   - Or use any MySQL client (Workbench, DBeaver) with the public proxy host
     Railway gives you.

> The first time the seed script runs from the backend it will populate optional
> sample users plus workout/meal library content for development.

---

## 2. Deploy the backend (Express API)

### Railway

1. In your Railway project: **New Service** → **GitHub Repo** → pick your
   FightForge fork or upstream repository.
2. Railway will detect the repo. Set **Root Directory** to `backend`.
3. Railway will use the `Dockerfile` automatically. If not, set the start
   command to `node scripts/seed.js && node server.js`.
4. **Variables** tab — set every one of these:

   ```
   NODE_ENV=production
   PORT=5000
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   JWT_SECRET=<paste your generated secret here>
   CORS_ORIGIN=https://<your-vercel-app>.vercel.app
   ```

   The `${{MySQL.VAR}}` references auto-link to the MySQL service Railway
   provisioned above.

5. **Settings** tab → **Generate Domain**. You'll get a URL like
   `https://fightforge-api-production.up.railway.app`. Copy it — you'll need
   it in step 3.

6. Verify the API is up: open `https://<that-url>/api/health` in a browser.
   You should see `{"ok":true,"service":"fightforge-api"}`.

### Generate JWT_SECRET

If you don't have one yet:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Never commit it. Paste it into your hosting platform's environment
variables UI only.

---

## 3. Deploy the frontend (Vercel)

**Important:** In the Vercel project, set **Root Directory** to **`frontend`** (see **[`VERCEL.md`](VERCEL.md)**). Do not leave the root as `.` unless you add your own root `package.json` build.

1. Sign in at <https://vercel.com> with GitHub.
2. **Add New** → **Project** → **Import** your GitHub repository.
3. **Configure Project**:
   - **Root Directory**: **`frontend`** (required)
   - **Framework Preset**: Vite (auto-detected)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
4. **Environment Variables**:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `VITE_API_BASE` | `https://<your-railway-api>.up.railway.app` | Required |
   | `VITE_SHOW_DEMO_ACCOUNTS` | _(leave unset, or set to `false`)_ | Hides sample-account quick-fill on Login and the sample-credentials callout on Home. Keep `false` on any public URL. |

5. Click **Deploy**. First build takes ~30s. You'll get a URL like
   `https://fightforge.vercel.app`.

6. Go back to Railway, edit the backend's `CORS_ORIGIN` variable, and paste
   the Vercel URL in (replace any placeholder). Railway will redeploy.

7. Open the Vercel URL. If you ran the optional seed script during setup, you can
   sign in with the sample accounts from `README.md`; otherwise use **Sign up**
   to create real users.

That's it — every push to `main` on GitHub auto-deploys frontend (Vercel)
*and* backend (Railway).

---

## Common pitfalls

- **CORS errors in the browser console.** Backend's `CORS_ORIGIN` doesn't
  include your Vercel URL. Update it on Railway and let it redeploy.
- **`Server error during login`.** Backend can't reach MySQL — verify the
  `DB_*` variables and check that you ran the schema SQL.
- **`/workouts` 404s on refresh.** `vercel.json` is missing or malformed.
  The included one rewrites all non-asset paths to `/index.html`.
- **Tokens stop working after redeploy.** You changed `JWT_SECRET` between
  deploys, which invalidates every existing token. Users just need to log
  in again. Don't rotate it unless you mean to.
- **Sample data missing.** The seed script only inserts rows that don't
  already exist (idempotent). If your deploy command runs seed on start, the
  next boot will refill; otherwise run `node scripts/seed.js` once after applying
  the schema.

---

## Alternative: deploy everything on Railway

If you don't want to split between Vercel and Railway, you can put the
frontend on Railway too. Add a third service pointing at `frontend/` with
the included `Dockerfile`. Then you don't need `vercel.json` or
`VITE_API_BASE` — just set up Railway domains for both services and update
`CORS_ORIGIN` accordingly.

Vercel still wins on free-tier static hosting + global CDN for the SPA,
which is why the split is the recommendation.
