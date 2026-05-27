# CI/CD (GitHub Actions)

## Quick setup (checklist)

| Step | Where | What |
| --- | --- | --- |
| 1 | GitHub → **Actions** → enable workflows | Workflows live on **`main`** (merge `ci/github-actions-pipeline` if needed) |
| 2 | **Variables** | (optional) `USE_SELF_HOSTED` = `false` only if you want GitHub-hosted runners again |
| 3 | Runner PC | Node 20+, Docker Desktop running; runner `.\run.cmd` shows **Listening for Jobs**; labels include `self-hosted`, `Windows`, `X64` |
| 4 | **Actions → CI → Run workflow** | Confirm all jobs green; optional required check: **CI passed** |
| 5 | **Secrets** (optional deploy) | `FLY_API_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| 6 | **Variables** (optional deploy) | `ENABLE_CD` = `true` after secrets are set |

GitHub Actions runs **CI** on every push/PR to `main` and `integration`, and **CD** when changes land on `main` with `ENABLE_CD=true` (or when triggered manually).

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

CD deploy jobs are **skipped** unless `ENABLE_CD` = `true` and the secrets below are set. CI always runs without deploy secrets.

---

## Self-hosted runner (Windows)

Use your own PC as a GitHub Actions runner (label **`fightforge`**) when GitHub-hosted minutes are unavailable or you want local Docker/Node.

### 1. Install prerequisites on the runner machine

- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the backend Docker CI job)
- Git

### 2. Register the runner

From the repo root in PowerShell:

```powershell
.\scripts\setup-github-runner.ps1
```

The script prints a link to create a **registration token** (Settings → Actions → Runners → New self-hosted runner → Windows). Then run:

```powershell
.\scripts\setup-github-runner.ps1 -RegistrationToken "YOUR_TOKEN" -InstallService
```

If configure failed once, generate a **new** token on the runners page (tokens are short-lived and invalidated after a failed attempt). Retry with `-CleanInstall`:

```powershell
.\scripts\setup-github-runner.ps1 -RegistrationToken "NEW_TOKEN" -CleanInstall -InstallService
```

Use the **registration token** from the runners setup page — not a Personal Access Token (PAT). A `404` on registration almost always means wrong or expired token.

Runner files install to `%LOCALAPPDATA%\fightforge-actions-runner` (not in the git repo).

Start manually without a service:

```powershell
cd $env:LOCALAPPDATA\fightforge-actions-runner
.\run.cmd
```

### 3. Point workflows at the runner

In GitHub: **Settings → Secrets and variables → Actions → Variables**

| Variable | Value |
| --- | --- |
| `USE_SELF_HOSTED` | `true` |

Push or re-run **CI**. Jobs use `runs-on: [self-hosted, Windows, X64]` instead of `ubuntu-latest` (default runner labels; the setup script also adds `fightforge` if you use `setup-github-runner.ps1`).

To test once without the variable: **Actions → CI → Run workflow** → check **use_self_hosted**.

Set `USE_SELF_HOSTED` = `false` in repo variables to use GitHub-hosted runners (requires billing in good standing).

### Troubleshooting

| Issue | Fix |
| --- | --- |
| Job queued forever | Runner offline, or label mismatch — runner must have `self-hosted`, `Windows`, and `X64` (re-register with `.\scripts\setup-github-runner.ps1` or add labels at registration) |
| CI fails instantly on GitHub-hosted | Account billing lock — set `USE_SELF_HOSTED=true` and keep your runner online |
| Docker build fails | Start Docker Desktop; ensure Linux containers mode works |
| Token expired / 404 on register | Generate a **new** registration token; use `-CleanInstall`; do not use a PAT |
| `Unrecognized ... 'windows'` | Update script (removed invalid `--windows` flag) and re-run with `-CleanInstall` |

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
