const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { signToken, authenticate } = require('../middleware/auth');

const router = express.Router();

function sanitizeUser(row) {
  if (!row) return null;
  const { password_hash, ...u } = row;
  return u;
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

module.exports = router;
