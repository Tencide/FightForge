import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On Vercel, apply-vercel-api-rewrite.mjs adds an /api edge rewrite to
// VITE_API_BASE. The browser must use same-origin /api (empty base) so CORS
// does not block; the proxy forwards to the real API.
// FIGHTFORGE_VERCEL_BUILD is set in frontend/vercel.json buildCommand so this
// works even when Vercel "System environment variables" is disabled (VERCEL=1
// would otherwise be missing).
const vercelPlatformBuild =
  process.env.VERCEL === '1' || process.env.FIGHTFORGE_VERCEL_BUILD === '1';
const vercelWithApiBase =
  vercelPlatformBuild && !!(process.env.VITE_API_BASE || '').trim();

// https://vite.dev/config/
export default defineConfig({
  define: vercelWithApiBase
    ? {
        'import.meta.env.VITE_API_BASE': JSON.stringify(''),
        'import.meta.env.VITE_FF_VERCEL_PROXY': JSON.stringify('1'),
      }
    : undefined,
  plugins: [react()],
  server: {
    host: true,
    // Dev: allow HTTPS tunnel hostnames (ngrok, Cloudflare) and same-Wi-Fi access.
    // See docs/SHARE_LINK.md. Not used in `vite build`.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
