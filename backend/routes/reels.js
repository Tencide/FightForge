const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { reelVideoUpload } = require('../middleware/reelUpload');
const { classifyVideoUrl } = require('../lib/youtube');
const { publicPathForFilename, deleteUploadedFile, mediaPathForFilename } = require('../lib/reelUploads');
const { scheduleReelTranscode, isReelProcessing } = require('../lib/reelTranscodeQueue');

const router = express.Router();

const SPORTS = new Set(['mma', 'boxing', 'bjj', 'kickboxing', 'wrestling', 'muay_thai', 'general']);

function mapReel(row, { videoProcessing } = {}) {
  const reel = {
    id: row.id,
    authorId: row.author_id,
    videoUrl: row.video_url,
    videoKind: row.video_kind,
    caption: row.caption,
    sport: row.sport,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      fullName: row.author_name,
      role: row.author_role,
      avatarUrl: row.author_avatar,
    },
    likeCount: Number(row.like_count || 0),
    likedByMe: Boolean(row.liked_by_me),
  };
  if (videoProcessing) reel.videoProcessing = true;
  return reel;
}

const reelSelect = `
  SELECT r.id, r.author_id, r.video_url, r.video_kind, r.caption, r.sport, r.created_at,
    u.full_name AS author_name, u.role AS author_role, u.avatar_url AS author_avatar,
    (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id) AS like_count,
    EXISTS(SELECT 1 FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = ?) AS liked_by_me
  FROM reels r
  JOIN users u ON u.id = r.author_id`;

router.get('/', authenticate, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const sport = req.query.sport ? String(req.query.sport).trim() : '';

    let sql = `
      ${reelSelect}
    `;
    const params = [req.user.id];

    if (sport && SPORTS.has(sport)) {
      sql += ' WHERE r.sport = ?';
      params.push(sport);
    }

    sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json({
      reels: rows.map((row) =>
        mapReel(row, { videoProcessing: isReelProcessing(row.id) })
      ),
      limit,
      offset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reels' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { videoUrl, caption, sport } = req.body || {};
    const classified = classifyVideoUrl(videoUrl);
    if (!classified) {
      return res.status(400).json({
        error:
          'Paste a YouTube link, or a direct .mp4 / .webm / .mov URL. Other links open externally.',
      });
    }

    const sportVal = sport && SPORTS.has(sport) ? sport : 'general';
    const cap =
      caption == null || caption === ''
        ? null
        : String(caption).trim().slice(0, 500);

    const [result] = await pool.query(
      `INSERT INTO reels (author_id, video_url, video_kind, caption, sport)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, classified.url, classified.kind, cap, sportVal]
    );

    const [rows] = await pool.query(
      `SELECT r.id, r.author_id, r.video_url, r.video_kind, r.caption, r.sport, r.created_at,
        u.full_name AS author_name, u.role AS author_role, u.avatar_url AS author_avatar,
        0 AS like_count, 0 AS liked_by_me
       FROM reels r
       JOIN users u ON u.id = r.author_id
       WHERE r.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ reel: mapReel({ ...rows[0], liked_by_me: 0, like_count: 0 }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create reel' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const reelId = Number(req.params.id);
    if (!reelId) return res.status(400).json({ error: 'Invalid reel id' });

    const [rows] = await pool.query(`${reelSelect} WHERE r.id = ?`, [req.user.id, reelId]);
    if (!rows.length) return res.status(404).json({ error: 'Reel not found' });

    res.json({
      reel: mapReel(rows[0], { videoProcessing: isReelProcessing(reelId) }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reel' });
  }
});

router.post('/upload', authenticate, reelVideoUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Choose a video file or record from your camera.' });
    }

    const { caption, sport } = req.body || {};
    const sportVal = sport && SPORTS.has(sport) ? sport : 'general';
    const cap =
      caption == null || caption === ''
        ? null
        : String(caption).trim().slice(0, 500);

    const storedName = req.file.filename;
    const diskPath = mediaPathForFilename(storedName);
    const videoUrl = publicPathForFilename(storedName);

    const [result] = await pool.query(
      `INSERT INTO reels (author_id, video_url, video_kind, caption, sport)
       VALUES (?, ?, 'direct', ?, ?)`,
      [req.user.id, videoUrl, cap, sportVal]
    );

    const reelId = result.insertId;
    const videoProcessing = scheduleReelTranscode(reelId, diskPath);

    const [rows] = await pool.query(
      `${reelSelect} WHERE r.id = ?`,
      [req.user.id, reelId]
    );

    res.status(201).json({
      reel: mapReel({ ...rows[0], liked_by_me: 0, like_count: 0 }, { videoProcessing }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload reel' });
  }
});

router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const reelId = Number(req.params.id);
    if (!reelId) return res.status(400).json({ error: 'Invalid reel id' });

    const [exists] = await pool.query('SELECT id FROM reels WHERE id = ?', [reelId]);
    if (!exists.length) return res.status(404).json({ error: 'Reel not found' });

    await pool.query('INSERT IGNORE INTO reel_likes (reel_id, user_id) VALUES (?, ?)', [
      reelId,
      req.user.id,
    ]);

    const [counts] = await pool.query(
      'SELECT COUNT(*) AS c FROM reel_likes WHERE reel_id = ?',
      [reelId]
    );
    res.json({ liked: true, likeCount: counts[0].c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to like reel' });
  }
});

router.delete('/:id/like', authenticate, async (req, res) => {
  try {
    const reelId = Number(req.params.id);
    if (!reelId) return res.status(400).json({ error: 'Invalid reel id' });

    await pool.query('DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?', [
      reelId,
      req.user.id,
    ]);

    const [counts] = await pool.query(
      'SELECT COUNT(*) AS c FROM reel_likes WHERE reel_id = ?',
      [reelId]
    );
    res.json({ liked: false, likeCount: counts[0].c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unlike reel' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const reelId = Number(req.params.id);
    if (!reelId) return res.status(400).json({ error: 'Invalid reel id' });

    const [rows] = await pool.query(
      'SELECT author_id, video_url FROM reels WHERE id = ?',
      [reelId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Reel not found' });

    const isOwner = rows[0].author_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own reels' });
    }

    deleteUploadedFile(rows[0].video_url);
    await pool.query('DELETE FROM reels WHERE id = ?', [reelId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete reel' });
  }
});

module.exports = router;
