# CI/CD (GitHub Actions)

GitHub Actions runs **CI** on every push/PR to `main` and `integration`, and **CD** when changes land on `main` (or when triggered manually).

| Workflow | File | When it runs |
| --- | --- | --- |
| **CI** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Push/PR to `main`, `integration`, or `ci/**` |
| **CD** | [`.github/workflows/cd.yml`](../.github/workflows/cd.yml) | Push to `main`, or **Actions → CD → Run workflow** |

iOS builds stay on **Codemagic** ([`codemagic.yaml`](../codemagic.yaml)); this pipeline covers the web stack (Vite + Express).

---

## CI jobs

1. **Frontend** — `npm ci`, `npm run lint`, Vercel-style `npm run build` (`FIGHTFORGE_VERCEL_BUILD=1`).
2. **Backend** — validates the Fly **`backend/Dockerfile`** image builds (no push).
3. **Smoke (unit)** — `cd backend && npm test` (plan generators, YouTube helpers; no network).
4. **Smoke (API)** — hits `https://fightforge-api.fly.dev` (health, auth, seeded demo users).

Local equivalents:

```bash
cd frontend && npm ci && npm run lint && FIGHTFORGE_VERCEL_BUILD=1 VITE_API_BASE=https://fightforge-api.fly.dev npm run build
cd backend && npm test
cd backend && npm run test:api
```

---

## CD setup (one-time)

Add these **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Used for |
| --- | --- |
| `FLY_API_TOKEN` | `flyctl deploy` for `fightforge-api` ([Fly tokens](https://fly.io/docs/security/tokens/)) |
| `VERCEL_TOKEN` | Vercel CLI deploy ([tokens](https://vercel.com/account/settings/tokens)) |
| `VERCEL_ORG_ID` | Team/user ID (`vercel link` or project settings) |
| `VERCEL_PROJECT_ID` | Frontend project ID (root directory **`frontend`**) |

Optional: create a GitHub **environment** named `production` with required reviewers before CD runs.

CD assumes:

- Fly app name **`fightforge-api`** in [`backend/fly.toml`](../backend/fly.toml).
- Vercel project **Root Directory** = **`frontend`**.

If secrets are missing, the CD workflow will fail at deploy time — CI still runs without them.

---

## Branch workflow

1. Open a PR from `ci/github-actions-pipeline` (or your feature branch) into `main`.
2. Confirm the **CI** workflow is green on the PR.
3. Merge to `main` → **CD** deploys API then frontend (if secrets are configured).

To test CI on the pipeline branch only:

```bash
git push -u origin ci/github-actions-pipeline
```

GitHub runs **CI** on pushes to `ci/**` without merging to `main`.

---

## Related docs

- [DEPLOY.md](DEPLOY.md) — hosting overview  
- [FLY.md](FLY.md) — API on Fly.io  
- [VERCEL.md](VERCEL.md) — frontend on Vercel  
- [APPLE_APP_STORE.md](APPLE_APP_STORE.md) — iOS via Codemagic  
