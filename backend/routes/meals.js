const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const {
  generateMealPlan,
  generateDailyMealPlan,
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

function canManage(user) {
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
      [rows] = await pool.query(
        `SELECT m.*, u.full_name AS athlete_name FROM meals m
         JOIN users u ON u.id = m.athlete_id ORDER BY m.created_at DESC`
      );
    } else if (req.user.role === 'coach') {
      const ids = await athleteIdsForCoach(req.user.id);
      const parts = ['m.created_by = ?'];
      const params = [req.user.id];
      if (ids.length) {
        parts.push(`m.athlete_id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
      [rows] = await pool.query(
        `SELECT m.*, u.full_name AS athlete_name FROM meals m
         JOIN users u ON u.id = m.athlete_id
         WHERE (${parts.join(' OR ')})
         ORDER BY m.created_at DESC`,
        params
      );
    } else {
      [rows] = await pool.query(
        `SELECT m.*, u.full_name AS athlete_name FROM meals m
         JOIN users u ON u.id = m.athlete_id
         WHERE m.athlete_id = ? ORDER BY m.created_at DESC`,
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
      `SELECT m.*, u.full_name AS athlete_name FROM meals m
       JOIN users u ON u.id = m.athlete_id WHERE m.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Meal not found' });
    const m = rows[0];
    if (req.user.role === 'athlete' && m.athlete_id !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    if (req.user.role === 'coach') {
      const ids = await athleteIdsForCoach(req.user.id);
      const ok = m.created_by === req.user.id || ids.includes(m.athlete_id);
      if (!ok) return res.status(403).json({ error: 'Not allowed' });
    }
    return res.json(m);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

function asNumOrNull(v) {
  return v === '' || v == null ? null : Number(v);
}

/**
 * POST /api/meals/generate
 * Self-service: any authenticated user generates a meal plan for themselves
 * with calculated calories + macros based on their saved profile goals.
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
    const plan = generateMealPlan(profile);
    const [result] = await pool.query(
      `INSERT INTO meals
        (title, description, athlete_id, created_by, target_calories, protein_g, carbs_g, fat_g, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.title,
        plan.description,
        req.user.id,
        req.user.id,
        plan.targetCalories,
        plan.proteinG,
        plan.carbsG,
        plan.fatG,
        plan.notes,
      ]
    );
    const [created] = await pool.query('SELECT * FROM meals WHERE id = ?', [result.insertId]);
    return res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/meals/generate-today
 * One-click "today's meal plan" — picks breakfast/lunch/dinner/snack from the
 * curated meal_library, scaled to the user's goal-weight calorie target.
 * Falls back to safe defaults if the profile is incomplete.
 */
router.post('/generate-today', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, role, profile FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const profile = parseProfile(rows[0].profile) || {};
    const [library] = await pool.query('SELECT * FROM meal_library');
    if (!library.length) {
      return res.status(503).json({
        error:
          'Meal library is empty. Run the seed script (node scripts/seed.js) to populate it.',
      });
    }
    const plan = generateDailyMealPlan(profile, library);
    const [result] = await pool.query(
      `INSERT INTO meals
        (title, description, athlete_id, created_by, target_calories, protein_g, carbs_g, fat_g, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.title,
        plan.description,
        req.user.id,
        req.user.id,
        plan.targetCalories,
        plan.proteinG,
        plan.carbsG,
        plan.fatG,
        plan.notes,
      ]
    );
    const [created] = await pool.query('SELECT * FROM meals WHERE id = ?', [result.insertId]);
    return res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    if (!canManage(req.user)) {
      return res.status(403).json({ error: 'Only coaches and admins can create meal plans' });
    }
    const { title, description, athleteId, targetCalories, proteinG, carbsG, fatG, notes } =
      req.body;
    const aid = Number(athleteId);
    if (!title || !aid) {
      return res.status(400).json({ error: 'title and athleteId are required' });
    }
    const [athletes] = await pool.query(
      "SELECT id, coach_id FROM users WHERE id = ? AND role = 'athlete'",
      [aid]
    );
    if (!athletes.length) return res.status(400).json({ error: 'Invalid athlete' });
    if (req.user.role === 'coach' && athletes[0].coach_id !== req.user.id) {
      return res.status(403).json({ error: 'Athlete is not assigned to you' });
    }
    const [result] = await pool.query(
      `INSERT INTO meals
        (title, description, athlete_id, created_by, target_calories, protein_g, carbs_g, fat_g, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(title).trim(),
        description != null ? String(description) : '',
        aid,
        req.user.id,
        asNumOrNull(targetCalories),
        asNumOrNull(proteinG),
        asNumOrNull(carbsG),
        asNumOrNull(fatG),
        notes != null ? String(notes) : null,
      ]
    );
    const [created] = await pool.query('SELECT * FROM meals WHERE id = ?', [result.insertId]);
    return res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    if (!canManage(req.user)) {
      return res.status(403).json({ error: 'Only coaches and admins can update meals' });
    }
    const id = Number(req.params.id);
    const [existing] = await pool.query('SELECT * FROM meals WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Meal not found' });
    const m = existing[0];
    if (req.user.role === 'coach') {
      const ids = await athleteIdsForCoach(req.user.id);
      if (m.created_by !== req.user.id && !ids.includes(m.athlete_id)) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }
    const { title, description, athleteId, targetCalories, proteinG, carbsG, fatG, notes } =
      req.body;
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
    if (targetCalories !== undefined) {
      fields.push('target_calories = ?');
      vals.push(asNumOrNull(targetCalories));
    }
    if (proteinG !== undefined) {
      fields.push('protein_g = ?');
      vals.push(asNumOrNull(proteinG));
    }
    if (carbsG !== undefined) {
      fields.push('carbs_g = ?');
      vals.push(asNumOrNull(carbsG));
    }
    if (fatG !== undefined) {
      fields.push('fat_g = ?');
      vals.push(asNumOrNull(fatG));
    }
    if (notes !== undefined) {
      fields.push('notes = ?');
      vals.push(notes == null ? null : String(notes));
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(id);
    await pool.query(`UPDATE meals SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [out] = await pool.query('SELECT * FROM meals WHERE id = ?', [id]);
    return res.json(out[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/meals/:id/complete
 * Toggle meal-plan completion. Body: { completed: boolean }.
 * Permissions match workouts: athlete-self or coach/admin who manages.
 */
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await pool.query('SELECT * FROM meals WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Meal not found' });
    const m = existing[0];

    const role = req.user.role;
    const isAthleteOwner = role === 'athlete' && m.athlete_id === req.user.id;
    const isAdmin = role === 'admin';
    let isCoachOwner = false;
    if (role === 'coach') {
      if (m.created_by === req.user.id) {
        isCoachOwner = true;
      } else {
        const ids = await athleteIdsForCoach(req.user.id);
        isCoachOwner = ids.includes(m.athlete_id);
      }
    }
    if (!isAthleteOwner && !isCoachOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const completed = req.body && req.body.completed !== undefined ? Boolean(req.body.completed) : true;
    const wasComplete = !!m.completed_at;
    let xpResult = null;

    if (completed && !wasComplete) {
      await pool.query(
        'UPDATE meals SET completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      xpResult = await awardXp(pool, m.athlete_id, XP_REWARDS.mealComplete);
    } else if (!completed && wasComplete) {
      await pool.query('UPDATE meals SET completed_at = NULL WHERE id = ?', [id]);
      xpResult = await awardXp(pool, m.athlete_id, -XP_REWARDS.mealComplete);
    }
    const [rows] = await pool.query(
      `SELECT m.*, u.full_name AS athlete_name FROM meals m
       JOIN users u ON u.id = m.athlete_id WHERE m.id = ?`,
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
    if (!canManage(req.user)) {
      return res.status(403).json({ error: 'Only coaches and admins can delete meals' });
    }
    const id = Number(req.params.id);
    const [existing] = await pool.query('SELECT * FROM meals WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Meal not found' });
    const m = existing[0];
    if (req.user.role === 'coach') {
      const ids = await athleteIdsForCoach(req.user.id);
      if (m.created_by !== req.user.id && !ids.includes(m.athlete_id)) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }
    await pool.query('DELETE FROM meals WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
