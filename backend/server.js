require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { UPLOAD_DIR, MEDIA_ROUTE, ensureUploadDir } = require('./lib/reelUploads');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workoutRoutes = require('./routes/workouts');
const mealRoutes = require('./routes/meals');
const progressRoutes = require('./routes/progress');
const messageRoutes = require('./routes/messages');
const friendRoutes = require('./routes/friends');
const reelRoutes = require('./routes/reels');
const { pool } = require('./config/db');
const { startWorkoutRetentionJob } = require('./lib/workoutRetention');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Refuse to boot in production with the dev default JWT secret. Tokens signed
// with a public secret are forgeable by anyone who can read the repo.
if (IS_PROD) {
  if (!process.env.JWT_SECRET || /change|dev|fightforge-dev-secret/i.test(process.env.JWT_SECRET)) {
    console.error('FATAL: JWT_SECRET must be set to a strong random value in production.');
    process.exit(1);
  }
}

// Behind a load balancer / proxy (Render, Fly.io, etc.) we need this so
// req.ip and secure cookies work correctly.
app.set('trust proxy', 1);

// CORS_ORIGIN can be a single origin or a comma-separated list, e.g.
//   CORS_ORIGIN=https://fightforge.vercel.app,https://www.fightforge.app
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Capacitor / Ionic WebView origins (TestFlight, App Store). Browsers cannot forge these. */
function isCapacitorWebViewOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  if (/^capacitor:\/\//i.test(origin)) return true;
  if (/^ionic:\/\//i.test(origin)) return true;
  if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin)) return true;
  // Capacitor ios.scheme in capacitor.config.json (e.g. FightForge://localhost)
  if (/^[a-z][a-z0-9+\-.]*:\/\/localhost(?::\d+)?$/i.test(origin)) return true;
  return false;
}

// In development, reflect the request Origin (origin: true). That covers Vite
// with host: true (localhost, 127.0.0.1, LAN IP, IPv6) without maintaining a
// list. A strict allowlist alone often breaks login with opaque browser /
// proxy failures that surface as 500s.
// In production, enforce CORS_ORIGIN when set; if unset, still reflect (same
// as previous empty-list behavior — set CORS_ORIGIN in prod deployments).
const corsOptions =
  IS_PROD && allowedOrigins.length > 0
    ? {
        origin(origin, callback) {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          if (isCapacitorWebViewOrigin(origin)) return callback(null, true);
          return callback(null, false);
        },
        credentials: true,
      }
    : { origin: true, credentials: true };

ensureUploadDir();

// Reel media before CORS — avoid Access-Control-Allow-Credentials + * (breaks <video>)
app.use(MEDIA_ROUTE, (req, res, next) => {
  const ext = (req.path || '').toLowerCase();
  if (ext.endsWith('.mp4') || ext.endsWith('.m4v')) res.type('video/mp4');
  else if (ext.endsWith('.webm')) res.type('video/webm');
  else if (ext.endsWith('.mov')) res.type('video/quicktime');
  const origin = req.headers.origin;
  if (origin && (!IS_PROD || !allowedOrigins.length || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    return res.status(204).end();
  }
  next();
});
app.use(MEDIA_ROUTE, express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use((err, _req, res, next) => {
  if (err.status === 400 && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  next(err);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fightforge-api' });
});

// No SPA on this service; bare domain hits should point people at /api.
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'fightforge-api',
    hint: 'Routes live under /api — try GET /api/health',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/reels', reelRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `FightForge API listening on port ${PORT}` +
      (IS_PROD ? ' (production)' : ' (dev — http://127.0.0.1:' + PORT + ')')
  );
  pool
    .query('SELECT 1 AS ok')
    .then(() => console.log('MySQL connection pool ready'))
    .catch((err) => console.error('MySQL warm-up failed:', err.message));
  startWorkoutRetentionJob();
});
