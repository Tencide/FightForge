const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function canAccessAthlete(req, athleteUserId) {
  if (req.user.role === 'admin') return true;
  if (req.user.id === athleteUserId) return true;
  if (req.user.role === 'coach') {
    const [rows] = await pool.query(
      "SELECT coach_id FROM users WHERE id = ? AND role = 'athlete'",
      [athleteUserId]
    );
    return rows.length > 0 && rows[0].coach_id === req.user.id;
  }
  return false;
}

router.get('/:userId', authenticate, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    const ok = await canAccessAthlete(req, userId);
    if (!ok) return res.status(403).json({ error: 'Not allowed to view this progress' });
    const [rows] = await pool.query(
      `SELECT p.*, u.full_name AS user_name FROM progress_entries p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ? ORDER BY p.recorded_at DESC, p.id DESC`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const {
      userId: bodyUserId,
      weightLb,
      bodyFatPct,
      benchPressLb,
      squatLb,
      cardioMinutes,
      notes,
      recordedAt,
    } = req.body;
    const targetUserId = bodyUserId != null ? Number(bodyUserId) : req.user.id;
    if (!targetUserId) return res.status(400).json({ error: 'Invalid user' });
    if (req.user.role === 'athlete' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Athletes may only log their own progress' });
    }
    const ok = await canAccessAthlete(req, targetUserId);
    if (!ok) return res.status(403).json({ error: 'Not allowed' });
    if (!recordedAt) return res.status(400).json({ error: 'recordedAt (YYYY-MM-DD) is required' });
    const [result] = await pool.query(
      `INSERT INTO progress_entries
        (user_id, weight_lb, body_fat_pct, bench_press_lb, squat_lb, cardio_minutes, notes, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId,
        weightLb === '' || weightLb == null ? null : Number(weightLb),
        bodyFatPct === '' || bodyFatPct == null ? null : Number(bodyFatPct),
        benchPressLb === '' || benchPressLb == null ? null : Number(benchPressLb),
        squatLb === '' || squatLb == null ? null : Number(squatLb),
        cardioMinutes === '' || cardioMinutes == null ? null : Number(cardioMinutes),
        notes != null ? String(notes) : null,
        String(recordedAt).slice(0, 10),
      ]
    );
    const [rows] = await pool.query(
      `SELECT p.*, u.full_name AS user_name FROM progress_entries p
       JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
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
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const [existing] = await pool.query('SELECT * FROM progress_entries WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Progress entry not found' });
    const row = existing[0];
    const ok = await canAccessAthlete(req, row.user_id);
    if (!ok) return res.status(403).json({ error: 'Not allowed' });
    if (req.user.role === 'athlete' && row.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    const { weightLb, bodyFatPct, benchPressLb, squatLb, cardioMinutes, notes, recordedAt } =
      req.body;
    const updates = [];
    const vals = [];
    if (weightLb !== undefined) {
      updates.push('weight_lb = ?');
      vals.push(weightLb === '' || weightLb == null ? null : Number(weightLb));
    }
    if (bodyFatPct !== undefined) {
      updates.push('body_fat_pct = ?');
      vals.push(bodyFatPct === '' || bodyFatPct == null ? null : Number(bodyFatPct));
    }
    if (benchPressLb !== undefined) {
      updates.push('bench_press_lb = ?');
      vals.push(benchPressLb === '' || benchPressLb == null ? null : Number(benchPressLb));
    }
    if (squatLb !== undefined) {
      updates.push('squat_lb = ?');
      vals.push(squatLb === '' || squatLb == null ? null : Number(squatLb));
    }
    if (cardioMinutes !== undefined) {
      updates.push('cardio_minutes = ?');
      vals.push(cardioMinutes === '' || cardioMinutes == null ? null : Number(cardioMinutes));
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      vals.push(notes == null ? null : String(notes));
    }
    if (recordedAt !== undefined) {
      updates.push('recorded_at = ?');
      vals.push(String(recordedAt).slice(0, 10));
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(id);
    await pool.query(`UPDATE progress_entries SET ${updates.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query(
      `SELECT p.*, u.full_name AS user_name FROM progress_entries p
       JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
      [id]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const [existing] = await pool.query('SELECT * FROM progress_entries WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Progress entry not found' });
    const row = existing[0];
    const ok = await canAccessAthlete(req, row.user_id);
    if (!ok) return res.status(403).json({ error: 'Not allowed' });
    if (req.user.role === 'athlete' && row.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    await pool.query('DELETE FROM progress_entries WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
