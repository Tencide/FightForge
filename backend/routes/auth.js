const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { signToken, authenticate } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');
const { RESET_TTL_MS, createResetToken, hashResetToken } = require('../lib/passwordReset');

const router = express.Router();

function sanitizeUser(row) {
  if (!row) return null;
  const { password_hash, ...u } = row;
  return u;
}

// Public base URL of the web app, used to build reset links. Prefer an explicit
// APP_PUBLIC_URL; otherwise fall back to the first http(s) CORS origin, then dev.
function appBaseUrl() {
  const fromEnv = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const origins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter((o) => /^https?:\/\//i.test(o));
  if (origins.length) return origins[0].replace(/\/+$/, '');
  return 'http://localhost:5173';
}

// Minimal in-memory rate limit for password-reset requests (per process). Keeps
// the endpoint from being used to blast emails or probe accounts.
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX_PER_WINDOW = 5;
const resetHits = new Map();

function rateLimited(key) {
  const now = Date.now();
  const entry = resetHits.get(key);
  if (!entry || now > entry.resetAt) {
    resetHits.set(key, { count: 1, resetAt: now + RESET_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RESET_MAX_PER_WINDOW;
}

router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email, password, and fullName are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const normalized = String(email).trim().toLowerCase();
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalized]);
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'athlete')`,
      [normalized, password_hash, String(fullName).trim()]
    );
    const userId = result.insertId;
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = sanitizeUser(rows[0]);
    const token = signToken({ id: user.id, role: user.role, email: user.email });
    return res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during signup' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const normalized = String(email).trim().toLowerCase();
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [normalized]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const row = rows[0];
    if (!row.password_hash || typeof row.password_hash !== 'string') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const user = sanitizeUser(row);
    const token = signToken({ id: user.id, role: user.role, email: user.email });
    return res.json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

router.get('/profile/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const target = rows[0];
    const self = req.user.id === id;
    const admin = req.user.role === 'admin';
    const coachOwns =
      req.user.role === 'coach' && target.role === 'athlete' && target.coach_id === req.user.id;
    if (!self && !admin && !coachOwns) {
      return res.status(403).json({ error: 'Not allowed to view this profile' });
    }
    return res.json(sanitizeUser(target));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Request a reset link. Always responds the same way whether or not the email
// exists, so it can't be used to discover which emails have accounts.
router.post('/forgot-password', async (req, res) => {
  const generic = {
    message: 'If an account exists for that email, a password reset link has been sent.',
  };
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (rateLimited(`forgot:${ip}`)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const normalized = String(email).trim().toLowerCase();
    const [rows] = await pool.query(
      'SELECT id, email, full_name FROM users WHERE email = ?',
      [normalized]
    );

    // Unknown email: respond generically without creating a token.
    if (!rows.length) return res.json(generic);

    const user = rows[0];
    const { raw, hash } = createResetToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    // Invalidate any earlier outstanding tokens for this user, then store the new one.
    await pool.query(
      'UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );
    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hash, expiresAt]
    );

    const link = `${appBaseUrl()}/reset-password?token=${raw}`;
    const name = user.full_name ? ` ${user.full_name}` : '';
    const { delivered } = await sendMail({
      to: user.email,
      subject: 'Reset your FightForge password',
      text:
        `Hi${name},\n\n` +
        `We received a request to reset your FightForge password. ` +
        `Open the link below within 30 minutes to choose a new one:\n\n${link}\n\n` +
        `If you didn't request this, you can safely ignore this email — your password won't change.`,
      html:
        `<p>Hi${name},</p>` +
        `<p>We received a request to reset your FightForge password. ` +
        `This link is valid for 30 minutes:</p>` +
        `<p><a href="${link}">Reset your password</a></p>` +
        `<p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    });

    const payload = { ...generic };
    // Dev-only convenience: when no SMTP is configured and we're not in
    // production, return the link so the flow is testable without email.
    if (!delivered && process.env.NODE_ENV !== 'production') {
      payload.devResetLink = link;
    }
    return res.json(payload);
  } catch (err) {
    console.error('[forgot-password]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Complete a reset using the token from the emailed link.
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const tokenHash = hashResetToken(token);
    const [rows] = await pool.query(
      'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1',
      [tokenHash]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'This reset link is invalid or has already been used.' });
    }
    const row = rows[0];
    if (row.used_at) {
      return res.status(400).json({ error: 'This reset link has already been used.' });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }

    const password_hash = await bcrypt.hash(String(password), 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, row.user_id]);
    // Single-use: burn this token and any other outstanding ones for the user.
    await pool.query(
      'UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [row.user_id]
    );

    return res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (err) {
    console.error('[reset-password]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
