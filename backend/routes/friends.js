const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const FRIEND_USER_COLUMNS = 'u.id, u.full_name, u.email, u.role, u.xp, u.overall';

/**
 * GET /api/friends
 * Returns the caller's social graph in three buckets:
 *   - friends:        accepted friendships
 *   - incoming:       pending requests where caller is recipient
 *   - outgoing:       pending requests sent by caller
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const me = req.user.id;

    const [friends] = await pool.query(
      `SELECT f.id AS friendship_id,
              f.created_at AS friends_since,
              ${FRIEND_USER_COLUMNS}
         FROM friendships f
         JOIN users u
           ON u.id = CASE WHEN f.requester_id = ? THEN f.recipient_id ELSE f.requester_id END
        WHERE f.status = 'accepted'
          AND (f.requester_id = ? OR f.recipient_id = ?)
        ORDER BY u.overall DESC, u.xp DESC, u.full_name`,
      [me, me, me]
    );

    const [incoming] = await pool.query(
      `SELECT f.id AS friendship_id,
              f.created_at AS requested_at,
              ${FRIEND_USER_COLUMNS}
         FROM friendships f
         JOIN users u ON u.id = f.requester_id
        WHERE f.status = 'pending' AND f.recipient_id = ?
        ORDER BY f.created_at DESC`,
      [me]
    );

    const [outgoing] = await pool.query(
      `SELECT f.id AS friendship_id,
              f.created_at AS requested_at,
              ${FRIEND_USER_COLUMNS}
         FROM friendships f
         JOIN users u ON u.id = f.recipient_id
        WHERE f.status = 'pending' AND f.requester_id = ?
        ORDER BY f.created_at DESC`,
      [me]
    );

    return res.json({ friends, incoming, outgoing });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/friends/leaderboard
 * Caller + accepted friends, ranked by overall DESC, then xp DESC.
 */
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.role, u.xp, u.overall,
              (u.id = ?) AS is_self
         FROM users u
        WHERE u.id = ?
           OR u.id IN (
              SELECT CASE WHEN f.requester_id = ? THEN f.recipient_id ELSE f.requester_id END
                FROM friendships f
               WHERE f.status = 'accepted'
                 AND (f.requester_id = ? OR f.recipient_id = ?)
           )
        ORDER BY u.overall DESC, u.xp DESC, u.full_name`,
      [me, me, me, me, me]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/friends/search?q=...
 * Find users to send friend requests to. Excludes self and any user the
 * caller already has any friendship row with (pending or accepted).
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const me = req.user.id;
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.xp, u.overall
         FROM users u
        WHERE u.id <> ?
          AND (u.full_name LIKE ? OR u.email LIKE ?)
          AND u.id NOT IN (
            SELECT CASE WHEN f.requester_id = ? THEN f.recipient_id ELSE f.requester_id END
              FROM friendships f
             WHERE (f.requester_id = ? OR f.recipient_id = ?)
          )
        ORDER BY u.overall DESC, u.full_name
        LIMIT 25`,
      [me, like, like, me, me, me]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/friends/requests
 * Body: { userId }
 * Sends a friend request from the caller to userId.
 *
 * If a row already exists in either direction:
 *   - already accepted -> 200 with the existing relationship
 *   - caller already requested it -> 200 (idempotent)
 *   - the *other* user previously requested the caller -> auto-accept
 */
router.post('/requests', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const targetId = Number(req.body && req.body.userId);
    if (!targetId || targetId === me) {
      return res.status(400).json({ error: 'Invalid target user' });
    }
    const [target] = await pool.query('SELECT id FROM users WHERE id = ?', [targetId]);
    if (!target.length) return res.status(404).json({ error: 'User not found' });

    const [existing] = await pool.query(
      `SELECT * FROM friendships
        WHERE (requester_id = ? AND recipient_id = ?)
           OR (requester_id = ? AND recipient_id = ?)
        LIMIT 1`,
      [me, targetId, targetId, me]
    );

    if (existing.length) {
      const row = existing[0];
      if (row.status === 'accepted') {
        return res.json({ status: 'accepted', friendship: row });
      }
      if (row.requester_id === me) {
        return res.json({ status: 'pending', friendship: row });
      }
      // The other user already sent us a request — accept it.
      await pool.query(
        `UPDATE friendships SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [row.id]
      );
      const [updated] = await pool.query('SELECT * FROM friendships WHERE id = ?', [row.id]);
      return res.json({ status: 'accepted', friendship: updated[0] });
    }

    const [result] = await pool.query(
      `INSERT INTO friendships (requester_id, recipient_id, status) VALUES (?, ?, 'pending')`,
      [me, targetId]
    );
    const [rows] = await pool.query('SELECT * FROM friendships WHERE id = ?', [result.insertId]);
    return res.status(201).json({ status: 'pending', friendship: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/friends/requests/:id/accept
 * Only the recipient of a pending request can accept it.
 */
router.post('/requests/:id/accept', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM friendships WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });
    const row = rows[0];
    if (row.recipient_id !== me) {
      return res.status(403).json({ error: 'Only the recipient can accept this request' });
    }
    if (row.status === 'accepted') {
      return res.json(row);
    }
    await pool.query(
      `UPDATE friendships SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    const [updated] = await pool.query('SELECT * FROM friendships WHERE id = ?', [id]);
    return res.json(updated[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/friends/requests/:id/reject
 * Recipient rejects a pending request -> deletes the row entirely so the
 * requester can try again later.
 */
router.post('/requests/:id/reject', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM friendships WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });
    const row = rows[0];
    if (row.recipient_id !== me) {
      return res.status(403).json({ error: 'Only the recipient can reject this request' });
    }
    await pool.query('DELETE FROM friendships WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/friends/:userId
 * Either side can remove a friendship (also cancels a pending outgoing one).
 */
router.delete('/:userId', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const otherId = Number(req.params.userId);
    if (!otherId) return res.status(400).json({ error: 'Invalid user id' });
    const [result] = await pool.query(
      `DELETE FROM friendships
        WHERE (requester_id = ? AND recipient_id = ?)
           OR (requester_id = ? AND recipient_id = ?)`,
      [me, otherId, otherId, me]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'No friendship found with that user' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
