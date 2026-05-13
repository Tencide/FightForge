const TOKEN_KEY = 'fightforge_token';

/**
 * API base URL.
 *
 * - In dev (Vite dev server): leave empty. Calls go to `/api/...` (relative)
 *   and the Vite dev server proxies them to the backend (see vite.config.js).
 * - In prod (Vercel build): set VITE_API_BASE in Vercel env vars to the
 *   absolute URL of the deployed backend, e.g. `https://api.example.com`.
 *   Requests then go to `https://api.example.com/api/...`.
 *
 * A trailing slash is stripped so VITE_API_BASE="https://api.example.com/"
 * works too.
 */
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

export function buildUrl(path) {
  if (!API_BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
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

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  const auth = token ?? getToken();
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const msg = data?.error || data?.message || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
