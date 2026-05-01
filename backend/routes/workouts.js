const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function canManageWorkouts(user) {
  return user.role === 'coach' || user.role === 'admin';
}

async function athleteIdsForCoach(coachId) {
  const [rows] = await pool.query(
    "SELECT id FROM users WHERE role = 'athlete' AND coach_id = ?",
    [coachId]
  );
  return rows.map((r) => r.id);
}

router.get('/', authenticate, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      ;[rows] = await pool.query(
        `SELECT w.*, u.full_name AS athlete_name FROM workouts w
         JOIN users u ON u.id = w.athlete_id ORDER BY w.created_at DESC`
      );
    } else if (req.user.role === 'coach') {
      const ids = await athleteIdsForCoach(req.user.id);
      const parts = ['w.created_by = ?'];
      const params = [req.user.id];
      if (ids.length) {
        parts.push(`w.athlete_id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
      ;[rows] = await pool.query(
        `SELECT w.*, u.full_name AS athlete_name FROM workouts w
         JOIN users u ON u.id = w.athlete_id
         WHERE (${parts.join(' OR ')})
         ORDER BY w.created_at DESC`,
        params
      );
    } else {
      ;[rows] = await pool.query(
        `SELECT w.*, u.full_name AS athlete_name FROM workouts w
         JOIN users u ON u.id = w.athlete_id
         WHERE w.athlete_id = ? ORDER BY w.created_at DESC`,
        [req.user.id]
      );
    }
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT w.*, u.full_name AS athlete_name FROM workouts w
       JOIN users u ON u.id = w.athlete_id WHERE w.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Workout not found' });
    const w = rows[0];
    if (req.user.role === 'athlete' && w.athlete_id !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    if (req.user.role === 'coach') {
      const ids = await athleteIdsForCoach(req.user.id);
      const ok = w.created_by === req.user.id || ids.includes(w.athlete_id);
      if (!ok) return res.status(403).json({ error: 'Not allowed' });
    }
    return res.json(w);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    if (!canManageWorkouts(req.user)) {
      return res.status(403).json({ error: 'Only coaches and admins can create workouts' });
    }
    const { title, description, content, athleteId } = req.body;
    const aid = Number(athleteId);
    if (!title || !aid) {
      return res.status(400).json({ error: 'title and athleteId are required' });
    }
    const [athletes] = await pool.query(
      "SELECT id, coach_id, role FROM users WHERE id = ? AND role = 'athlete'",
      [aid]
    );
    if (!athletes.length) return res.status(400).json({ error: 'Invalid athlete' });
    if (req.user.role === 'coach') {
      if (athletes[0].coach_id !== req.user.id) {
        return res.status(403).json({ error: 'Athlete is not assigned to you' });
      }
    }
    const [result] = await pool.query(
      `INSERT INTO workouts (title, description, content, athlete_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(title).trim(),
        description != null ? String(description) : '',
        content != null ? String(content) : '',
        aid,
        req.user.id,
      ]
    );
    const [created] = await pool.query('SELECT * FROM workouts WHERE id = ?', [result.insertId]);
    return res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    if (!canManageWorkouts(req.user)) {
      return res.status(403).json({ error: 'Only coaches and admins can update workouts' });
    }
    const id = Number(req.params.id);
    const [existing] = await pool.query('SELECT * FROM workouts WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Workout not found' });
    const w = existing[0];
    if (req.user.role === 'coach') {
      const ids = await athleteIdsForCoach(req.user.id);
      if (w.created_by !== req.user.id && !ids.includes(w.athlete_id)) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }
    const { title, description, content, athleteId } = req.body;
    const fields = [];
    const vals = [];
    if (title !== undefined) {
      fields.push('title = ?');
      vals.push(String(title).trim());
    }
    if (description !== undefined) {
      fields.push('description = ?');
      vals.push(String(description));
    }
    if (content !== undefined) {
      fields.push('content = ?');
      vals.push(String(content));
    }
    if (athleteId !== undefined) {
      const aid = Number(athleteId);
      const [athletes] = await pool.query(
        "SELECT id, coach_id FROM users WHERE id = ? AND role = 'athlete'",
        [aid]
      );
      if (!athletes.length) return res.status(400).json({ error: 'Invalid athlete' });
      if (req.user.role === 'coach' && athletes[0].coach_id !== req.user.id) {
        return res.status(403).json({ error: 'Athlete is not assigned to you' });
      }
      fields.push('athlete_id = ?');
      vals.push(aid);
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(id);
    await pool.query(`UPDATE workouts SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query('SELECT * FROM workouts WHERE id = ?', [id]);
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!canManageWorkouts(req.user)) {
      return res.status(403).json({ error: 'Only coaches and admins can delete workouts' });
    }
    const id = Number(req.params.id);
    const [existing] = await pool.query('SELECT * FROM workouts WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Workout not found' });
    const w = existing[0];
    if (req.user.role === 'coach') {
      const ids = await athleteIdsForCoach(req.user.id);
      if (w.created_by !== req.user.id && !ids.includes(w.athlete_id)) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }
    await pool.query('DELETE FROM workouts WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
