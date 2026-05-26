  # Publishing FightForge on the Apple App Store

FightForge today is a **web app** (React + Vite) at [fightforge.vercel.app](https://fightforge.vercel.app). Apple does not accept “just a website URL” as an App Store listing—you ship a **native iOS wrapper** that loads your built UI. This repo uses **[Capacitor](https://capacitorjs.com/)** for that.

You will need:

| Requirement | Notes |
|-------------|--------|
| **Apple Developer Program** | [developer.apple.com](https://developer.apple.com) — **$99 USD / year** |
| **macOS for the `.ipa`** | Apple’s toolchain only runs on macOS — but you **do not need to own a Mac** (see [No Mac?](#no-mac-you-still-need-macos-somewhere)). |
| **App Store Connect** | Create the app record, screenshots, description, privacy policy URL, age rating, export compliance |
| **Legal / policy** | Public **Privacy Policy** URL (required). Terms optional but recommended. |
| **API CORS** | Fly `CORS_ORIGIN` must allow the Capacitor WebView origin (see below) |

---

## Architecture

```
┌─────────────────┐     HTTPS      ┌──────────────────────────┐
│  iOS app shell  │  ────────────► │ fightforge-api.fly.dev   │
│  (Capacitor +   │   JSON + media │ Express + MySQL (Aiven)  │
│   WKWebView)    │                └──────────────────────────┘
└─────────────────┘
  Bundled files: frontend/dist (HTML/JS/CSS)
```

The phone app is your **same React UI**, talking to the **same Fly API** as production. No separate “mobile backend.”

---

## 1. One-time: Apple Developer & App Store Connect

1. Enroll in the **Apple Developer Program** (individual or organization).
2. Open **App Store Connect** → **Apps** → **+** → **New App**.
3. Set **Bundle ID** (must match Capacitor `appId`, e.g. `com.fightforge.app`) — register it under **Certificates, Identifiers & Profiles** if needed.
4. Prepare:
   - **App name**, subtitle, description, keywords
   - **Screenshots** (6.7", 6.5", 5.5" iPhone sizes; use Simulator or device)
   - **Support URL** and **Privacy Policy URL** (host on your site or GitHub Pages)
   - **App Privacy** questionnaire (data collection: account email, user content, etc.)
   - **Age rating** questionnaire (fitness / social features → answer honestly)
5. For **reels / camera uploads**, declare **Photo Library** and **Camera** usage in App Privacy and in `Info.plist` (already templated in the iOS project).

---

## 2. Build the web app for mobile

From `frontend/`:

```bash
npm ci
npm run build:mobile
```

This sets `VITE_API_BASE=https://fightforge-api.fly.dev` so the app calls Fly directly (same as production uploads/video).

---

## 3. Sync Capacitor & open Xcode (on a Mac)

```bash
cd frontend
npm run cap:sync
npm run cap:ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → your Team, automatic signing.
2. Set **Display Name** to `FightForge`, version/build numbers.
3. **Product → Archive** → **Distribute App** → **App Store Connect** → Upload.

First-time: run on a **physical iPhone** to verify login, library, and reel upload.

---

## 4. API: allow Capacitor origin (Fly)

The iOS app (TestFlight / App Store) calls **`https://fightforge-api.fly.dev`** directly. Requests come from the WebView origin **`capacitor://localhost`** (not your Vercel URL). If the API rejects that origin, login shows **“Could not reach the server (load failed)”**.

**Recommended:** redeploy the latest **`backend/`** — production CORS now **automatically allows** Capacitor/Ionic WebView origins (`capacitor://…`, `ionic://…`, `http(s)://localhost`).

You can still set an explicit list (comma-separated, no spaces after commas):

```bash
fly secrets set CORS_ORIGIN="https://fightforge.vercel.app,capacitor://localhost,ionic://localhost" -a fightforge-api
fly deploy -a fightforge-api
```

Verify from a browser: open **`https://fightforge-api.fly.dev/api/health`** — you should see `{"ok":true,"service":"fightforge-api"}`.

If you use a custom URL scheme in `capacitor.config.json`, include that origin too when setting `CORS_ORIGIN`.

---

## 5. App Review checklist (common rejections)

- **Login**: Provide a **demo account** in App Review notes (or “Sign up” must work without external steps).
- **Minimum functionality**: App must not be a thin browser to a single marketing page; FightForge’s logged-in features are fine.
- **User-generated content** (reels, library workouts): Document **report/block** or moderation plan; consider reporting in a future update if absent.
- **Account deletion**: Apple expects in-app account deletion if you support account creation ([Guideline 5.1.1](https://developer.apple.com/app-store/review/guidelines/)).
- **Payments**: Only use Apple IAP for **digital goods consumed in the app**; coaching SaaS / real-world gym services may be exempt—confirm with Apple if you add subscriptions.
- **Privacy**: Privacy Policy must match actual data (email, profile, messages, reels, progress).

---

## No Mac? You still need macOS *somewhere*

Apple does not let you compile or sign iOS apps on Windows. With an **Apple Developer** account you already have the hard part. You only need **temporary access to macOS** (about 1–2 hours for the first upload, less for updates).

Everything below is doable from your **Windows PC** — you use a browser to control cloud services.

### What you do on Windows today

1. Commit and push the repo (including `frontend/ios/`).
2. Create the app in **App Store Connect** (web) — bundle ID `com.fightforge.app`.
3. Create an **App Store Connect API key** (Users and Access → Integrations → App Store Connect API) — save the `.p8` file once; Codemagic/GitHub will use it.
4. Update Fly CORS (see [§4](#4-api-allow-capacitor-origin-fly)).

You never install Xcode on your PC.

---

### Option A — **Codemagic** (recommended, no Mac)

Best fit if you want “push code → get TestFlight build.”

1. Sign up at [codemagic.io](https://codemagic.io) → connect **GitHub** → select **FightForge** repo.
2. Enable the repo **`codemagic.yaml`** at the root (already in this project).
3. In Codemagic → your app → **Code signing**:
   - Link **App Store Connect** (API key from above), **or**
   - Upload **Apple Distribution** cert + **App Store** provisioning profile for `com.fightforge.app`.
4. **Integrations** → App Store Connect → connect the same API key for upload.
5. Push to `main` → workflow **FightForge iOS** runs on a cloud Mac → IPA → **TestFlight** (see `submit_to_app_store` in `codemagic.yaml` when ready for review).

**Cost:** free tier includes limited macOS minutes; paid plans if you build often.  
**Docs:** [Capacitor iOS on Codemagic](https://docs.codemagic.io/yaml-quick-start/capacitor-ios-workflow/)

First build failing on signing is normal — fix bundle ID / profiles in Codemagic’s signing UI until green.

---

### Option B — **Rent a cloud Mac by the hour** (feels like a real Mac)

Remote desktop into macOS, install nothing permanent on your PC.

| Service | Typical use |
|--------|-------------|
| [MacinCloud](https://www.macincloud.com/) | Pay-as-you-go Mac with Xcode preinstalled |
| [MacStadium](https://www.macstadium.com/) | Dedicated / CI Macs |
| [AWS EC2 Mac](https://aws.amazon.com/ec2/instance-types/mac/) | Powerful; **24h minimum** billing — overkill for one app |

**Steps (once):**

1. RDP/VNC into the cloud Mac.
2. Clone repo, `cd frontend && npm ci && npm run cap:sync && npm run cap:ios`.
3. Xcode → Signing → your Apple ID team → **Archive** → **Distribute** → App Store Connect.
4. On Windows, finish listing/screenshots in **App Store Connect** and submit for review.

**Cost:** often **~$4–15 for a few hours** — enough for first submit + one update.

---

### Option C — **GitHub Actions** (`macos-latest`)

Same idea as Codemagic but you maintain signing secrets yourself (`.p12`, provisioning profiles, API key in GitHub Secrets). Good if you already live in GitHub Actions; steeper setup than Codemagic.

Capacitor + `xcodebuild` examples: [Capacitor CI docs](https://capacitorjs.com/docs/guides/ci-cd).

---

### Option D — **Borrow a Mac** once

One afternoon on a friend’s MacBook: `npm run cap:sync`, Archive, upload. You still manage App Store Connect from Windows afterward.

---

### Comparison

| Approach | Mac owned? | Difficulty | Best for |
|----------|------------|------------|----------|
| **Codemagic** | No | Medium (UI signing) | Ongoing builds from Windows |
| **MacinCloud** | No | Low (like using a Mac) | First time / debugging Xcode issues |
| **GitHub Actions** | No | High | Teams already on Actions |
| **Borrowed Mac** | No | Low | One-off v1.0 |

---

### Screenshots without a Mac

- **Codemagic** / cloud Mac: use **Xcode → Simulator** (iPhone 15 Pro Max, etc.) → screenshots.
- Or install **TestFlight** on your iPhone after the first cloud build and screenshot the real app.

---

### Codemagic: `integration "Codemagic" does not exist`

The name in `integrations.app_store_connect` must **exactly** match **Settings → Integrations** (e.g. you may have named it `FightForge` not `Codemagic`).

**Current repo fix:** use **Team integrations** (no env group):

1. Codemagic → **Settings** (personal) → **Team integrations** → **Developer Portal** → **Manage keys** → **Add key**
2. **API key name:** `FightForge` (must match `integrations.app_store_connect` in `codemagic.yaml`)
3. Issuer ID, Key ID, `.p8` from App Store Connect → **Save**
4. Rebuild on `main`

**“Unknown variable group appstore_credentials”** — create that group in **Applications → FightForge → Environment variables**, or use the integrations method above (recommended; no group needed).

---

### Codemagic: “No matching profiles found”

That error means Codemagic had **no App Store certificate/profile** for `com.fightforge.app`.

**Fix (recommended):** **Settings → codemagic.yaml settings → Code signing identities** (do this before rebuilding):

1. **iOS certificates** → **Generate certificate** → **Apple Distribution** → API key **Codemagic** → reference name `fightforge_dist`
2. **iOS provisioning profiles** → **Fetch profiles** → **App Store** → `com.fightforge.app` → reference `fightforge_appstore`

The yaml uses `ios_signing` + `distribution_type: app_store` (no `--create` on the build machine).

**“Cannot save Signing Certificates without certificate private key”** — you skipped step 1; generate the Distribution cert in Codemagic UI (do not rely on `--create` during the build).

**Fix B (advanced):** add `CERTIFICATE_PRIVATE_KEY` env var if you use automatic `fetch-signing-files --create` (not used in current yaml).

**Legacy manual upload:** **Team settings → codemagic.yaml settings → Code signing identities**

1. **iOS certificates** → **Generate certificate** → type **Apple Distribution** → API key `Codemagic`
2. **iOS provisioning profiles** → **Fetch profiles** → App Store → `com.fightforge.app` → download with a reference name

Then you can use `ios_signing` + `distribution_type: app_store` in yaml instead of the fetch script.

Apple allows at most **3** Distribution certificates — revoke an old one in [developer.apple.com](https://developer.apple.com/account/resources/certificates/list) if generate fails.

---

## TestFlight: “Could not reach the server” / “load failed”

| Check | Action |
|-------|--------|
| **API up?** | On your phone or PC, open **`https://fightforge-api.fly.dev/api/health`**. If it fails, finish Fly deploy + billing (see **`docs/FLY.md`**). |
| **CORS** | Redeploy **`backend/`** (Capacitor origins allowed automatically) **or** set **`CORS_ORIGIN`** with **`capacitor://localhost,ionic://localhost`** (see [§4](#4-api-allow-capacitor-origin-fly)). |
| **Old build?** | Codemagic runs **`npm run cap:sync`** which bakes **`VITE_API_BASE=https://fightforge-api.fly.dev`**. Push to **`main`** and wait for a new TestFlight build after API fixes. |
| **Demo login** | Use seeded accounts only if your **production DB** was seeded; otherwise **Sign up** in the app. |

---

### Checklist (Windows + Apple Developer, no MacBook)

- [ ] Push repo with `frontend/ios/` and `codemagic.yaml`
- [ ] App Store Connect app + `com.fightforge.app` bundle ID
- [ ] App Store Connect API key (.p8) in Codemagic (or cert/profile uploaded)
- [ ] Fly `CORS_ORIGIN` includes `capacitor://localhost`
- [ ] Privacy policy URL on the store listing
- [ ] TestFlight build installs and login works
- [ ] Submit for review with demo account in notes

---

## 7. Optional improvements before submit

| Item | Why |
|------|-----|
| **@capacitor/splash-screen** | Branded launch screen |
| **@capacitor/status-bar** | Light/dark status bar to match theme |
| **Safe area** | Already using `viewport-fit=cover`; test notch devices |
| **Deep links** | `fightforge://` for shared reel links |
| **Push notifications** | Separate Apple capability + backend work |

---

## Quick reference (this repo)

| Script | Purpose |
|--------|---------|
| `npm run build:mobile` | Production Vite build → Fly API |
| `npm run cap:sync` | Build + copy `dist` into iOS project |
| `npm run cap:ios` | Open Xcode |

Config: `frontend/capacitor.config.json`  
iOS project: `frontend/ios/` (generated after `npx cap add ios` on a machine with Capacitor CLI)

---

## Related docs

- [DEPLOY.md](./DEPLOY.md) — API + Vercel + MySQL  
- [FLY.md](./FLY.md) — Fly secrets including `CORS_ORIGIN`  
- Root **`codemagic.yaml`** — cloud iOS build (no Mac)
