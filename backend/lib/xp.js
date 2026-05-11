/**
 * XP + overall rating helpers.
 *
 * Rules:
 *   - Every athlete starts at overall 60 with 0 XP.
 *   - Each completed workout = +50 XP. Each completed meal = +25 XP.
 *     Undoing the completion reverses the award (clamped to >= 0).
 *   - overall = clamp(60 + floor(xp / XP_PER_LEVEL), 60, 99).
 *     With XP_PER_LEVEL = 100, every 100 XP raises overall by 1, maxing at 99
 *     after 3,900 XP (~78 completed workouts or ~156 meals).
 */

const STARTING_OVERALL = 60;
const MAX_OVERALL = 99;
const XP_PER_LEVEL = 100;

const XP_REWARDS = Object.freeze({
  workoutComplete: 50,
  mealComplete: 25,
});

function computeOverall(xp) {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const level = Math.floor(safeXp / XP_PER_LEVEL);
  return Math.min(MAX_OVERALL, STARTING_OVERALL + level);
}

/**
 * Apply an XP delta to a user atomically.
 * Returns { xp, overall, deltaApplied, leveledUp }.
 *
 * deltaApplied may differ from delta if the user's XP would go below zero
 * (we clamp to 0).
 */
async function awardXp(pool, userId, delta) {
  if (!userId || !Number.isFinite(delta) || delta === 0) {
    return { xp: null, overall: null, deltaApplied: 0, leveledUp: false };
  }

  const [rows] = await pool.execute(
    'SELECT xp, overall FROM users WHERE id = ?',
    [userId]
  );
  if (!rows.length) {
    return { xp: null, overall: null, deltaApplied: 0, leveledUp: false };
  }

  const previousXp = Number(rows[0].xp) || 0;
  const previousOverall = Number(rows[0].overall) || STARTING_OVERALL;
  const nextXp = Math.max(0, previousXp + delta);
  const deltaApplied = nextXp - previousXp;
  const nextOverall = computeOverall(nextXp);

  await pool.execute(
    'UPDATE users SET xp = ?, overall = ? WHERE id = ?',
    [nextXp, nextOverall, userId]
  );

  return {
    xp: nextXp,
    overall: nextOverall,
    deltaApplied,
    leveledUp: nextOverall > previousOverall,
  };
}

module.exports = {
  STARTING_OVERALL,
  MAX_OVERALL,
  XP_PER_LEVEL,
  XP_REWARDS,
  computeOverall,
  awardXp,
};
