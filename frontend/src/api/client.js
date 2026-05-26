const TOKEN_KEY = 'fightforge_token';

/**
 * Optional hardcoded production API origin when you do **not** use `VITE_API_BASE`
 * (e.g. no variables in the Vercel dashboard). Must be `https://` if the site is HTTPS.
 * Leave empty to use `VITE_API_BASE` only, or same-origin `/api` (dev proxy / optional Vercel rewrite).
 *
 * Example: 'https://api.yourdomain.com'
 */
const API_ORIGIN_FALLBACK = '';

/**
 * Resolved API base: env wins, then in-file fallback. Trailing slashes stripped.
 * - Dev: usually empty → `/api/...` proxied by Vite to the backend.
 * - Prod: set `VITE_API_BASE` in the host **or** set `API_ORIGIN_FALLBACK` above.
 */
const API_BASE = (import.meta.env.VITE_API_BASE || API_ORIGIN_FALLBACK || '').replace(/\/+$/, '');

export function buildUrl(path) {
  if (!API_BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Origin for reel video files. Always hit the API directly in production so
 * <video> gets proper Range requests and MIME types (Vercel /api proxy breaks some players).
 */
export function getMediaBase() {
  return getUploadBase();
}

/** Resolve reel media paths (relative /api/...) for <video src> etc. */
export function resolveMediaUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getMediaBase();
  if (base) return `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
  return pathOrUrl;
}

/**
 * API origin for large multipart uploads. Vercel's /api proxy limits body size (~4.5 MB),
 * so uploads go directly to the Fly API in production when no VITE_API_BASE is set.
 */
export function getUploadBase() {
  if (API_BASE) return API_BASE;
  const envBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
  if (envBase) return envBase;
  if (import.meta.env.PROD) return 'https://fightforge-api.fly.dev';
  return 'http://127.0.0.1:5000';
}

/**
 * True when this is a production build (e.g. Vercel). Dev server has import.meta.env.DEV.
 */
function isProdBuild() {
  return import.meta.env.PROD === true;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

/** Non-2xx responses: prefer JSON `error` / `message`, else status; avoid dumping HTML bodies. */
function httpErrorMessage(res, data) {
  const code = res.status || 0;
  const reason = (res.statusText && String(res.statusText).trim()) || '';

  if (data && typeof data === 'object') {
    for (const key of ['error', 'message']) {
      const v = data[key];
      if (typeof v !== 'string' || !v.trim()) continue;
      const t = v.trim();
      if (t.startsWith('<')) {
        const lead = code ? `HTTP ${code}${reason ? ` ${reason}` : ''}` : 'Error';
        return `${lead} — the server returned HTML instead of JSON. On Vercel, check VITE_API_BASE is only the API origin (e.g. https://api.example.com with no /api path) and that the API is running.`;
      }
      return t.length > 320 ? `${t.slice(0, 320)}…` : t;
    }
  }

  if (code) return `HTTP ${code}${reason ? ` ${reason}` : ''}`;
  return 'Request failed';
}

function isCapacitorApp() {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  if (/^capacitor:/i.test(protocol) || /^ionic:/i.test(protocol)) return true;
  return import.meta.env.PROD && hostname === 'localhost';
}

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const vercelSameOriginProxy = import.meta.env.VITE_FF_VERCEL_PROXY === '1';
  if (isProdBuild() && path.startsWith('/api') && !API_BASE && !vercelSameOriginProxy) {
    throw new Error(
      'API URL is not configured. Either set VITE_API_BASE in your host (e.g. Vercel) and redeploy, or set API_ORIGIN_FALLBACK in frontend/src/api/client.js to your Express API origin (https, no trailing slash).'
    );
  }
  if (
    isProdBuild() &&
    API_BASE &&
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    API_BASE.startsWith('http:')
  ) {
    throw new Error(
      'API base must use https:// when the site is served over HTTPS (mixed content blocks http:// APIs).'
    );
  }

  const headers = { Accept: 'application/json' };
  const auth = token ?? getToken();
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const url = buildUrl(path);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const raw =
      e != null && typeof e.message === 'string'
        ? e.message
        : e != null && typeof e === 'object' && 'message' in e
          ? String(e.message)
          : String(e ?? '');
    const lower = raw.toLowerCase();
    const isNetworkish =
      e instanceof TypeError ||
      (typeof DOMException !== 'undefined' && e instanceof DOMException) ||
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('network error') ||
      lower.includes('network request failed') ||
      lower.includes('load failed') ||
      lower.includes('econnrefused');
    if (isNetworkish) {
      let hint = '';
      if (typeof window !== 'undefined') {
        const onVercel =
          window.location.hostname === 'vercel.app' ||
          window.location.hostname.endsWith('.vercel.app');
        if (url.startsWith('http') && !url.startsWith(window.location.origin)) {
          hint =
            " Often: API is down, wrong API URL, or CORS — add this site's origin to the backend CORS_ORIGIN.";
          if (isCapacitorApp()) {
            hint +=
              ' TestFlight/iOS: the API must allow Capacitor origins (capacitor://localhost). Redeploy the latest backend, or run: fly secrets set CORS_ORIGIN="https://your-vercel-app.vercel.app,capacitor://localhost,ionic://localhost" — see docs/APPLE_APP_STORE.md.';
          } else if (onVercel) {
            hint += ` Vercel: (1) Project → Settings → Environment Variables → add VITE_API_BASE = your API base URL (e.g. https://api.example.com), no trailing slash. (2) Save, then Redeploy (env is applied at build time). (3) On the API server, set CORS_ORIGIN to include https://${window.location.host} (add preview URLs too if you use Preview deployments).`;
          }
        } else if (url.startsWith('/')) {
          hint =
            ' For local dev: start the API (cd backend && npm start) on port 5000, or set VITE_PROXY_TARGET in frontend/.env to match your API port.';
          if (onVercel) {
            hint +=
              ' On Vercel, a relative /api URL only works if you add an /api proxy rewrite in frontend/vercel.json (see docs/VERCEL.md) or set VITE_API_BASE to your API.';
          }
        }
      }
      throw new Error(`Could not reach the server (${raw}).${hint}`);
    }
    throw e;
  }

  const data = await parseJson(res);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (path.startsWith('/api') && ct.includes('text/html') && res.ok) {
    throw new Error(
      'Received HTML instead of JSON — /api hit the static host, not your API. Set VITE_API_BASE or API_ORIGIN_FALLBACK in frontend/src/api/client.js, or add a Vercel rewrite from /api to your backend (see docs/VERCEL.md).'
    );
  }
  if (!res.ok) {
    let msg = httpErrorMessage(res, data);
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('.vercel.app') || window.location.hostname === 'vercel.app') &&
      url.startsWith('/api') &&
      [502, 503, 504].includes(res.status)
    ) {
      msg +=
        ' The Vercel /api proxy could not reach your backend — verify VITE_API_BASE, redeploy after env changes, and check your API host logs.';
    }
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('.vercel.app') || window.location.hostname === 'vercel.app') &&
      url.startsWith('/api') &&
      res.status === 405 &&
      method !== 'GET' &&
      method !== 'HEAD'
    ) {
      msg +=
        ' This usually means the /api proxy was not injected (missing VITE_API_BASE for this deployment type). In Vercel → Environment Variables, add VITE_API_BASE for **Preview** as well as Production, then redeploy this branch.';
    }
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Ping API so Fly machines wake before a large multipart upload. */
export async function wakeUploadApi() {
  const base = getUploadBase();
  try {
    await fetch(`${base}/api/health`, { method: 'GET', cache: 'no-store' });
  } catch {
    /* ignore */
  }
}

export function apiUpload(path, formData, { token, onProgress } = {}) {
  const base = getUploadBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const auth = token ?? getToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Accept', 'application/json');
    if (auth) xhr.setRequestHeader('Authorization', `Bearer ${auth}`);

    xhr.upload.onprogress = (ev) => {
      if (!onProgress || !ev.lengthComputable) return;
      onProgress(ev.loaded / ev.total);
    };

    xhr.onload = () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = { error: xhr.responseText };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(1);
        resolve(data);
        return;
      }
      const err = new Error(httpErrorMessage({ status: xhr.status, statusText: xhr.statusText }, data));
      err.status = xhr.status;
      err.data = data;
      reject(err);
    };

    xhr.onerror = () => reject(new Error('Upload failed — check your connection and try again.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(formData);
  });
}
