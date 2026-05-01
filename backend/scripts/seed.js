/**
 * Seed demo accounts (run after schema.sql).
 * Usage: node scripts/seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const DEMO_PASSWORD = 'Password123!';

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [admins] = await pool.query("SELECT id FROM users WHERE email = 'admin@fightforge.test'");
  if (!admins.length) {
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'admin')`,
      ['admin@fightforge.test', hash, 'FightForge Admin']
    );
  }

  const [coaches] = await pool.query("SELECT id FROM users WHERE email = 'coach@fightforge.test'");
  let coachId;
  if (!coaches.length) {
    const [r] = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'coach')`,
      ['coach@fightforge.test', hash, 'Demo Coach']
    );
    coachId = r.insertId;
  } else {
    coachId = coaches[0].id;
  }

  const [athletes] = await pool.query("SELECT id FROM users WHERE email = 'athlete@fightforge.test'");
  if (!athletes.length) {
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, coach_id) VALUES (?, ?, ?, 'athlete', ?)`,
      ['athlete@fightforge.test', hash, 'Demo Athlete', coachId]
    );
  } else {
    await pool.query('UPDATE users SET coach_id = ? WHERE email = ?', [coachId, 'athlete@fightforge.test']);
  }

  const [athleteRows] = await pool.query(
    "SELECT id FROM users WHERE email = 'athlete@fightforge.test' LIMIT 1"
  );
  const aid = athleteRows[0].id;

  const [wc] = await pool.query('SELECT COUNT(*) AS c FROM workouts WHERE athlete_id = ?', [aid]);
  if (wc[0].c === 0) {
    await pool.query(
      `INSERT INTO workouts (title, description, content, athlete_id, created_by) VALUES (?, ?, ?, ?, ?)`,
      [
        'Striking — Week 1',
        'Bag work and footwork',
        '- 10 min jump rope\n- 4x3 min heavy bag\n- 3 rounds shadow boxing',
        aid,
        coachId,
      ]
    );
  }

  const [pc] = await pool.query('SELECT COUNT(*) AS c FROM progress_entries WHERE user_id = ?', [aid]);
  if (pc[0].c === 0) {
    await pool.query(
      `INSERT INTO progress_entries
        (user_id, weight_lb, bench_press_lb, squat_lb, cardio_minutes, notes, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
      [aid, 185.0, 225, 315, 30, 'Baseline entry from seed']
    );
  }

  console.log('Seed complete. Demo password for all demo accounts:', DEMO_PASSWORD);
  console.log('  admin@fightforge.test (admin)');
  console.log('  coach@fightforge.test (coach)');
  console.log('  athlete@fightforge.test (athlete, assigned to coach)');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
