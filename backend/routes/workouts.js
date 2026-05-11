const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const {
  generateWorkoutPlan,
  generateDailyWorkout,
  profileSufficient,
} = require('../lib/planGenerators');
const { awardXp, XP_REWARDS } = require('../lib/xp');

const router = express.Router();

function parseProfile(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

/**
 * GET /api/workouts/library
 * Returns the curated workout templates the user can browse and copy from.
 * Declared BEFORE the `:id` route so Express doesn't try to parse "library"
 * as a numeric workout id.
 */
router.get('/library', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM workout_library ORDER BY title ASC');
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }
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

/**
 * POST /api/workouts/generate
 * Self-service: any authenticated user generates a workout plan for themselves
 * based on their saved profile goals. The current user becomes both creator
 * and athlete.
 */
router.post('/generate', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, role, profile FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const profile = parseProfile(rows[0].profile);
    if (!profileSufficient(profile)) {
      return res.status(400).json({
        error:
          'Your profile is missing required fields. Set sex, age, height, current weight, and goal on /profile first.',
      });
    }
    const plan = generateWorkoutPlan(profile);
    const [result] = await pool.query(
      `INSERT INTO workouts (title, description, content, athlete_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [plan.title, plan.description, plan.content, req.user.id, req.user.id]
    );
    const [created] = await pool.query('SELECT * FROM workouts WHERE id = ?', [result.insertId]);
    return res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

const DAY_PREFIXES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * POST /api/workouts/generate-today
 * One-click "today's workout" — idempotent: if the user already auto-generated
 * one today, return that existing record instead of creating a duplicate.
 * Pulls a matching tutorial video + curated content from the workout_library
 * when there's a match.
 *
 * Send `?force=1` to bypass idempotency and create a fresh one anyway.
 */
router.post('/generate-today', authenticate, async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';

    if (!force) {
      // "Auto-generated for today" = self-created, created today, title matches
      // any of the 'Mon workout', 'Tue workout', ..., 'Sun workout' prefixes
      // produced by generateDailyWorkout.
      const titleLikes = DAY_PREFIXES.map(() => 'title LIKE ?').join(' OR ');
      const params = [req.user.id, req.user.id, ...DAY_PREFIXES.map((d) => `${d} workout%`)];
      const [existing] = await pool.query(
        `SELECT w.*, u.full_name AS athlete_name FROM workouts w
         JOIN users u ON u.id = w.athlete_id
         WHERE w.athlete_id = ? AND w.created_by = ?
           AND w.created_at >= CURDATE()
           AND (${titleLikes})
         ORDER BY w.id DESC LIMIT 1`,
        params
      );
      if (existing.length) {
        return res.status(200).json(existing[0]);
      }
    }

    const [rows] = await pool.query(
      'SELECT id, role, profile FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const profile = parseProfile(rows[0].profile) || {};
    const [library] = await pool.query('SELECT * FROM workout_library');
    const plan = generateDailyWorkout(profile, library);
    const [result] = await pool.query(
      `INSERT INTO workouts (title, description, content, video_url, athlete_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        plan.title,
        plan.description,
        plan.content,
        plan.videoUrl || null,
        req.user.id,
        req.user.id,
      ]
    );
    const [created] = await pool.query(
      `SELECT w.*, u.full_name AS athlete_name FROM workouts w
       JOIN users u ON u.id = w.athlete_id WHERE w.id = ?`,
      [result.insertId]
    );
    return res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/workouts/library/:id/copy
 * Copy a library template into the user's own workouts. Body (optional):
 *   { athleteId }  — coaches/admins can target a specific athlete; defaults
 *                    to the current user otherwise.
 */
router.post('/library/:id/copy', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid library id' });
    const [tpl] = await pool.query('SELECT * FROM workout_library WHERE id = ?', [id]);
    if (!tpl.length) return res.status(404).json({ error: 'Template not found' });
    const t = tpl[0];

    let athleteId = req.user.id;
    if (req.body && req.body.athleteId !== undefined) {
      const requested = Number(req.body.athleteId);
      if (!Number.isFinite(requested)) {
        return res.status(400).json({ error: 'Invalid athleteId' });
      }
      if (requested !== req.user.id) {
        if (!canManageWorkouts(req.user)) {
          return res
            .status(403)
            .json({ error: 'Only coaches/admins can add a workout for someone else' });
        }
        const [athletes] = await pool.query(
          "SELECT id, coach_id, role FROM users WHERE id = ? AND role = 'athlete'",
          [requested]
        );
        if (!athletes.length) return res.status(400).json({ error: 'Invalid athlete' });
        if (req.user.role === 'coach' && athletes[0].coach_id !== req.user.id) {
          return res.status(403).json({ error: 'Athlete is not assigned to you' });
        }
      }
      athleteId = requested;
    }

    const [result] = await pool.query(
      `INSERT INTO workouts (title, description, content, video_url, athlete_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [t.title, t.description || '', t.content || '', t.video_url || null, athleteId, req.user.id]
    );
    const [created] = await pool.query(
      `SELECT w.*, u.full_name AS athlete_name FROM workouts w
       JOIN users u ON u.id = w.athlete_id WHERE w.id = ?`,
      [result.insertId]
    );
    return res.status(201).json(created[0]);
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
    const { title, description, content, athleteId, videoUrl } = req.body;
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
    const cleanVideoUrl = videoUrl != null && String(videoUrl).trim()
      ? String(videoUrl).trim().slice(0, 500)
      : null;
    const [result] = await pool.query(
      `INSERT INTO workouts (title, description, content, video_url, athlete_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(title).trim(),
        description != null ? String(description) : '',
        content != null ? String(content) : '',
        cleanVideoUrl,
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
    const { title, description, content, athleteId, videoUrl } = req.body;
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
    if (videoUrl !== undefined) {
      fields.push('video_url = ?');
      vals.push(
        videoUrl == null || String(videoUrl).trim() === ''
          ? null
          : String(videoUrl).trim().slice(0, 500)
      );
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

/**
 * POST /api/workouts/:id/complete
 * Toggle workout completion. Body: { completed: boolean }.
 * - The athlete the workout is assigned to can mark their own done/undone.
 * - The coach who created/manages it (or any admin) can also toggle.
 */
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await pool.query('SELECT * FROM workouts WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Workout not found' });
    const w = existing[0];

    const role = req.user.role;
    const isAthleteOwner = role === 'athlete' && w.athlete_id === req.user.id;
    const isAdmin = role === 'admin';
    let isCoachOwner = false;
    if (role === 'coach') {
      if (w.created_by === req.user.id) {
        isCoachOwner = true;
      } else {
        const ids = await athleteIdsForCoach(req.user.id);
        isCoachOwner = ids.includes(w.athlete_id);
      }
    }
    if (!isAthleteOwner && !isCoachOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const completed = req.body && req.body.completed !== undefined ? Boolean(req.body.completed) : true;
    const wasComplete = !!w.completed_at;
    let xpResult = null;

    if (completed && !wasComplete) {
      await pool.query(
        'UPDATE workouts SET completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      xpResult = await awardXp(pool, w.athlete_id, XP_REWARDS.workoutComplete);
    } else if (!completed && wasComplete) {
      await pool.query('UPDATE workouts SET completed_at = NULL WHERE id = ?', [id]);
      xpResult = await awardXp(pool, w.athlete_id, -XP_REWARDS.workoutComplete);
    }
    const [rows] = await pool.query(
      `SELECT w.*, u.full_name AS athlete_name FROM workouts w
       JOIN users u ON u.id = w.athlete_id WHERE w.id = ?`,
      [id]
    );
    const payload = { ...rows[0] };
    if (xpResult) {
      payload.xp = { delta: xpResult.deltaApplied, total: xpResult.xp, overall: xpResult.overall, leveledUp: xpResult.leveledUp };
    }
    return res.json(payload);
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
