const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Snapchat-style ephemeral retention. Once a recipient sees a message we
 * give them this many seconds before it auto-deletes (unless either party
 * has flagged it as `saved`). Cleanup runs lazily on every messages GET so
 * we don't need a cron job.
 */
const EPHEMERAL_TTL_SECONDS = 60;

async function sweepExpiredFor(userId) {
  await pool.query(
    `DELETE FROM messages
     WHERE saved = 0
       AND seen_at IS NOT NULL
       AND seen_at < (NOW() - INTERVAL ? SECOND)
       AND (sender_id = ? OR recipient_id = ?)`,
    [EPHEMERAL_TTL_SECONDS, userId, userId]
  );
}

/**
 * GET /api/messages — list "conversation partners" for the current user.
 *  - athletes: their assigned coach (if any) + admins they've messaged with
 *  - coaches: athletes assigned to them + admins
 *  - admins: anyone they've ever messaged with
 * Returns: [{ partner: {id, full_name, role}, last: {body, created_at, sender_id} | null }]
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const me = req.user;
    await sweepExpiredFor(me.id);
    const partnerSet = new Map();

    if (me.role === 'athlete') {
      const [coach] = await pool.query(
        `SELECT u.id, u.full_name, u.role
         FROM users u
         JOIN users athlete ON athlete.coach_id = u.id
         WHERE athlete.id = ?`,
        [me.id]
      );
      if (coach.length) partnerSet.set(coach[0].id, coach[0]);
    } else if (me.role === 'coach') {
      const [athletes] = await pool.query(
        `SELECT id, full_name, role FROM users WHERE role = 'athlete' AND coach_id = ?`,
        [me.id]
      );
      for (const a of athletes) partnerSet.set(a.id, a);
    }

    const [chatted] = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.role
       FROM users u
       WHERE u.id IN (
         SELECT recipient_id FROM messages WHERE sender_id = ?
         UNION
         SELECT sender_id FROM messages WHERE recipient_id = ?
       )`,
      [me.id, me.id]
    );
    for (const u of chatted) partnerSet.set(u.id, u);

    const partners = Array.from(partnerSet.values());
    if (partners.length === 0) return res.json([]);

    const ids = partners.map((p) => p.id);
    const [lasts] = await pool.query(
      `SELECT m1.* FROM messages m1
       INNER JOIN (
         SELECT
           CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS partner_id,
           MAX(id) AS max_id
         FROM messages
         WHERE sender_id = ? OR recipient_id = ?
         GROUP BY partner_id
       ) latest
       ON m1.id = latest.max_id`,
      [me.id, me.id, me.id]
    );
    const lastByPartner = new Map();
    for (const m of lasts) {
      const partnerId = m.sender_id === me.id ? m.recipient_id : m.sender_id;
      lastByPartner.set(partnerId, m);
    }

    const result = partners
      .filter((p) => ids.includes(p.id))
      .map((p) => ({
        partner: p,
        last: lastByPartner.get(p.id) || null,
      }))
      .sort((a, b) => {
        const aT = a.last?.created_at ? new Date(a.last.created_at).getTime() : 0;
        const bT = b.last?.created_at ? new Date(b.last.created_at).getTime() : 0;
        return bT - aT;
      });

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:partnerId', authenticate, async (req, res) => {
  try {
    const partnerId = Number(req.params.partnerId);
    if (!partnerId) return res.status(400).json({ error: 'Invalid partner id' });
    await sweepExpiredFor(req.user.id);
    const [partner] = await pool.query(
      `SELECT id, full_name, role FROM users WHERE id = ?`,
      [partnerId]
    );
    if (!partner.length) return res.status(404).json({ error: 'User not found' });
    const [rows] = await pool.query(
      `SELECT * FROM messages
       WHERE (sender_id = ? AND recipient_id = ?)
          OR (sender_id = ? AND recipient_id = ?)
       ORDER BY created_at ASC, id ASC`,
      [req.user.id, partnerId, partnerId, req.user.id]
    );
    return res.json({
      partner: partner[0],
      messages: rows,
      ephemeralTtlSeconds: EPHEMERAL_TTL_SECONDS,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/messages/:id/seen
 * Mark a message as seen — only the recipient can do this. Idempotent: a
 * second call after the first leaves the original seen_at intact (so the TTL
 * clock doesn't reset on every render).
 */
router.post('/:id/seen', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Message not found' });
    const m = rows[0];
    if (m.recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the recipient can mark a message seen' });
    }
    if (!m.seen_at) {
      await pool.query(
        'UPDATE messages SET seen_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    }
    const [out] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    return res.json(out[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/messages/:id/save
 * Toggle save. Body: { saved: boolean }. Either the sender or the recipient
 * can save (or unsave). Saving locks the message in permanently and the
 * sweeper will skip it.
 */
router.post('/:id/save', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Message not found' });
    const m = rows[0];
    if (m.sender_id !== req.user.id && m.recipient_id !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'Only the sender or the recipient can save a message' });
    }
    const wantSaved =
      req.body && req.body.saved !== undefined ? Boolean(req.body.saved) : true;
    if (wantSaved) {
      await pool.query(
        'UPDATE messages SET saved = 1, saved_by = ? WHERE id = ?',
        [req.user.id, id]
      );
    } else {
      await pool.query(
        'UPDATE messages SET saved = 0, saved_by = NULL WHERE id = ?',
        [id]
      );
    }
    const [out] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    return res.json(out[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { recipientId, body } = req.body;
    const rid = Number(recipientId);
    const text = (body || '').trim();
    if (!rid) return res.status(400).json({ error: 'recipientId is required' });
    if (!text) return res.status(400).json({ error: 'Message body cannot be empty' });
    if (text.length > 4000) {
      return res.status(400).json({ error: 'Message too long (max 4000 chars)' });
    }
    if (rid === req.user.id) {
      return res.status(400).json({ error: 'You cannot message yourself' });
    }
    const [recipient] = await pool.query(
      'SELECT id, role, coach_id FROM users WHERE id = ?',
      [rid]
    );
    if (!recipient.length) return res.status(404).json({ error: 'Recipient not found' });

    if (req.user.role === 'athlete') {
      const r = recipient[0];
      const myCoach = await pool.query('SELECT coach_id FROM users WHERE id = ?', [req.user.id]);
      const myCoachId = myCoach[0][0]?.coach_id;
      const allowed = r.role === 'admin' || (r.role === 'coach' && r.id === myCoachId);
      if (!allowed) return res.status(403).json({ error: 'Athletes can only message their coach or admins' });
    } else if (req.user.role === 'coach') {
      const r = recipient[0];
      const allowed = r.role === 'admin' || (r.role === 'athlete' && r.coach_id === req.user.id);
      if (!allowed) {
        return res.status(403).json({ error: 'Coaches can only message their athletes or admins' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)`,
      [req.user.id, rid, text]
    );
    const [out] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    return res.status(201).json(out[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Message not found' });
    const m = rows[0];
    if (m.sender_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the sender or an admin can delete a message' });
    }
    await pool.query('DELETE FROM messages WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
