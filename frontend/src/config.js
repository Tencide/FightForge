/**
 * Client-side feature flags.
 *
 * All flags are sourced from Vite environment variables (must be prefixed
 * with VITE_ to be exposed to the browser). They are evaluated at build
 * time, so changing one requires a rebuild.
 *
 * Set them in `frontend/.env` for local development, or in Vercel's
 * Project Settings → Environment Variables for production.
 */

function boolEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Show the "Quick fill sample accounts" UI on Login/Home (optional dev aid).
 *
 * Defaults to FALSE so public builds do not advertise bundled test credentials.
 * Set VITE_SHOW_DEMO_ACCOUNTS=true in `.env` for local Docker or dev only.
 */
export const SHOW_DEMO_ACCOUNTS = boolEnv(import.meta.env.VITE_SHOW_DEMO_ACCOUNTS, false);
