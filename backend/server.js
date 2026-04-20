require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fightforge-api' });
});

// Feature routes are mounted on their respective branches:
//   /api/auth      -> feat/backend-auth-api
//   /api/workouts  -> feat/backend-workout-api
//   /api/progress  -> feat/backend-progress-api
//   /api/users, /api/meals, /api/messages -> teammate branches

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FightForge API listening on http://127.0.0.1:${PORT}`);
});
