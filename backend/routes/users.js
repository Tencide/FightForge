const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const SAFE_COLUMNS = 'id, email, full_name, role, coach_id, profile, xp, overall, created_at';

function isAdmin(req) {
  return req.user.role === 'admin';
}
function isCoach(req) {
  return req.user.role === 'coach';
}

router.get('/', authenticate, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const [rows] = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users ORDER BY role, full_name`
      );
      return res.json(rows);
    }
    if (isCoach(req)) {
      const [rows] = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users
         WHERE id = ? OR (role = 'athlete' AND coach_id = ?)
         ORDER BY role DESC, full_name`,
        [req.user.id, req.user.id]
      );
      return res.json(rows);
    }
    const [self] = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`,
      [req.user.id]
    );
    return res.json(self);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });
    const [rows] = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const target = rows[0];
    const self = req.user.id === id;
    const coachOwns =
      isCoach(req) && target.role === 'athlete' && target.coach_id === req.user.id;
    if (!self && !isAdmin(req) && !coachOwns) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    return res.json(target);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Only admins can create users directly' });
    }
    const { email, password, fullName, role, coachId } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email, password, fullName are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const validRole = ['athlete', 'coach', 'admin'].includes(role) ? role : 'athlete';
    const normalized = String(email).trim().toLowerCase();
    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [normalized]);
    if (exists.length) return res.status(409).json({ error: 'Email already in use' });
    const hash = await bcrypt.hash(password, 10);
    let coachIdValue = null;
    if (validRole === 'athlete' && coachId) {
      const [coach] = await pool.query(
        "SELECT id FROM users WHERE id = ? AND role = 'coach'",
        [Number(coachId)]
      );
      if (coach.length) coachIdValue = coach[0].id;
    }
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, coach_id)
       VALUES (?, ?, ?, ?, ?)`,
      [normalized, hash, String(fullName).trim(), validRole, coachIdValue]
    );
    const [rows] = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`,
      [result.insertId]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const self = req.user.id === id;
    if (!self && !isAdmin(req)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { fullName, email, password, role, coachId, profile } = req.body;
    const updates = [];
    const vals = [];

    if (fullName !== undefined) {
      updates.push('full_name = ?');
      vals.push(String(fullName).trim());
    }
    if (profile !== undefined) {
      updates.push('profile = ?');
      vals.push(profile == null ? null : JSON.stringify(profile));
    }
    if (email !== undefined) {
      const normalized = String(email).trim().toLowerCase();
      if (!normalized) return res.status(400).json({ error: 'Email cannot be empty' });
      const [collision] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [normalized, id]
      );
      if (collision.length) return res.status(409).json({ error: 'Email already in use' });
      updates.push('email = ?');
      vals.push(normalized);
    }
    if (password !== undefined && password !== '') {
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const hash = await bcrypt.hash(String(password), 10);
      updates.push('password_hash = ?');
      vals.push(hash);
    }
    if (role !== undefined) {
      if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can change roles' });
      }
      if (!['athlete', 'coach', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push('role = ?');
      vals.push(role);
    }
    if (coachId !== undefined) {
      if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can assign coaches' });
      }
      if (coachId === null || coachId === '') {
        updates.push('coach_id = ?');
        vals.push(null);
      } else {
        const [coach] = await pool.query(
          "SELECT id FROM users WHERE id = ? AND role = 'coach'",
          [Number(coachId)]
        );
        if (!coach.length) return res.status(400).json({ error: 'Invalid coach id' });
        updates.push('coach_id = ?');
        vals.push(coach[0].id);
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, vals);
    const [out] = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`,
      [id]
    );
    return res.json(out[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Only admins can delete users' });
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account' });
    }
    const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
