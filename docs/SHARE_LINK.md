# One link to share (phones, any network)

Teammates need a **public HTTPS URL**. Your laptop’s `http://192.168…` address only works on the same Wi‑Fi. Use one of these.

---

## Option A — Deploy (best for “text this link and it always works”)

Host the app on the internet once, then share something like `https://your-app.vercel.app`.

Follow **[`DEPLOY.md`](DEPLOY.md)** end-to-end: MySQL, Express API, Vercel (or other) frontend, `VITE_API_BASE`, `CORS_ORIGIN`. No tunnel, no PC that must stay on.

---

## Option B — Quick demo tunnel (laptop + Docker must stay running)

Use this when you just need **one link to send** and the stack is only on your machine.

1. On the machine with the repo, from the project root:

   ```bash
   docker compose up --build
   ```

2. Install a tunnel tool. Two common choices:
   - **[ngrok](https://ngrok.com/)** — sign up, install, then in a **second** terminal:  
     `ngrok http 5173`  
     ngrok prints an **`https://…ngrok-free.app`** (or similar) URL — **that is the link you send** to people’s phones.
   - **Cloudflare (no account for quick try)** — install `cloudflared`, then:  
     `cloudflared tunnel --url http://127.0.0.1:5173`  
     It shows a **`https://…trycloudflare.com`** URL to share.

3. Open that **https** link on a phone (cellular or Wi‑Fi). The first visit may show a short **ngrok** interstitial; tap **Visit Site** if you see it.

4. **Log in** with the seeded demo users (if you left `VITE_SHOW_DEMO_ACCOUNTS` on in Docker) and password **`Password123!`**, or sign up a throwaway account.

**Limits:** When you stop Docker or close the laptop, the link dies. Do **not** reuse important passwords on a tunnel URL — treat it like a public staging leak.

The repo’s **`vite.config.js`** sets **`server.allowedHosts: true`** in dev so Vite accepts tunnel `Host` headers (otherwise you get *Blocked request* from the dev server).

---

## Option C — Same house / office Wi‑Fi only

If everyone is on your LAN, you do **not** need a tunnel: use your PC’s IPv4 and `http://YOUR_LAN_IP:5173` as described in the main **[`README.md`](../README.md)**.
