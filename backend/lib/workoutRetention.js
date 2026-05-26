const { pool } = require('../config/db');

const DEFAULT_RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function retentionDays() {
  const n = parseInt(process.env.WORKOUT_RETENTION_DAYS, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_RETENTION_DAYS;
  return Math.min(n, 365);
}

/**
 * Delete athlete/coach workout rows older than the retention window.
 * Does not touch workout_library (shared templates).
 */
async function purgeOldWorkouts() {
  const days = retentionDays();
  const [result] = await pool.query(
    `DELETE FROM workouts WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [days]
  );
  const removed = result.affectedRows ?? 0;
  if (removed > 0) {
    console.log(`Purged ${removed} workout(s) older than ${days} day(s)`);
  }
  return removed;
}

function startWorkoutRetentionJob() {
  purgeOldWorkouts().catch((err) =>
    console.error('Workout retention purge failed:', err.message || err)
  );
  const id = setInterval(() => {
    purgeOldWorkouts().catch((err) =>
      console.error('Workout retention purge failed:', err.message || err)
    );
  }, CLEANUP_INTERVAL_MS);
  if (typeof id.unref === 'function') id.unref();
}

module.exports = { purgeOldWorkouts, startWorkoutRetentionJob, retentionDays };
