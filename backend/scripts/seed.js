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
      `INSERT INTO workouts (title, description, content, video_url, athlete_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'Striking — Week 1',
        'Bag work and footwork',
        '- 10 min jump rope\n- 4x3 min heavy bag\n- 3 rounds shadow boxing',
        // Replace with any MMA / boxing tutorial URL you like — supports
        // youtube.com/watch?v=, youtu.be/, embed URLs, or just the raw video ID.
        'https://www.youtube.com/watch?v=BlS3gkEOZdo',
        aid,
        coachId,
      ]
    );
  }

  const [pc] = await pool.query('SELECT COUNT(*) AS c FROM progress_entries WHERE user_id = ?', [aid]);
  if (pc[0].c === 0) {
    const points = [
      { offset: 28, weight: 192.0, bench: 215, squat: 295, cardio: 25, notes: 'Cut started' },
      { offset: 21, weight: 190.5, bench: 220, squat: 305, cardio: 28, notes: '' },
      { offset: 14, weight: 188.0, bench: 220, squat: 310, cardio: 30, notes: 'Felt strong' },
      { offset: 7, weight: 186.5, bench: 225, squat: 315, cardio: 30, notes: '' },
      { offset: 0, weight: 185.0, bench: 225, squat: 315, cardio: 30, notes: 'Baseline entry from seed' },
    ];
    for (const p of points) {
      await pool.query(
        `INSERT INTO progress_entries
          (user_id, weight_lb, bench_press_lb, squat_lb, cardio_minutes, notes, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY))`,
        [aid, p.weight, p.bench, p.squat, p.cardio, p.notes || null, p.offset]
      );
    }
  }

  const [mc] = await pool.query('SELECT COUNT(*) AS c FROM meals WHERE athlete_id = ?', [aid]);
  if (mc[0].c === 0) {
    await pool.query(
      `INSERT INTO meals
        (title, description, athlete_id, created_by, target_calories, protein_g, carbs_g, fat_g, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Fight week — cut',
        'Lean protein + complex carbs, low sodium during weight cut',
        aid,
        coachId,
        2400,
        220,
        240,
        70,
        'Drop carbs to 150g 48h before weigh-in. Hydrate aggressively until 24h out.',
      ]
    );
  }

  const [msgc] = await pool.query(
    'SELECT COUNT(*) AS c FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)',
    [coachId, aid, aid, coachId]
  );
  if (msgc[0].c === 0) {
    await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES
       (?, ?, ?, DATE_SUB(NOW(), INTERVAL 2 DAY)),
       (?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY)),
       (?, ?, ?, DATE_SUB(NOW(), INTERVAL 3 HOUR))`,
      [
        coachId, aid, "Welcome to the camp. Let's start with the Striking — Week 1 plan.",
        aid, coachId, 'Got it coach. Hit it this morning, feeling sharp.',
        coachId, aid, "Nice. Make sure you log progress today — eyeing your bench for next session.",
      ]
    );
  }

  await seedWorkoutLibrary();
  await seedMealLibrary();

  console.log('Seed complete. Demo password for all demo accounts:', DEMO_PASSWORD);
  console.log('  admin@fightforge.test (admin)');
  console.log('  coach@fightforge.test (coach)');
  console.log('  athlete@fightforge.test (athlete, assigned to coach)');
  await pool.end();
}

const WORKOUT_LIBRARY_SEEDS = [
  {
    title: 'Striking — Bag work fundamentals',
    description: 'Build punching power and combinations on the heavy bag.',
    category: 'striking',
    experience_level: 'beginner',
    duration_min: 45,
    video_url: 'https://www.youtube.com/watch?v=BlS3gkEOZdo',
    content: '10 min jump rope warmup\n4×3 min heavy bag — jab/cross/hook combos\n3×3 min shadow boxing focusing on footwork\n3×30 sec speed bag, 30 sec rest\n5 min cooldown + neck mobility',
  },
  {
    title: 'Striking & Conditioning',
    description: 'High-intensity bag rounds with burpee finishers.',
    category: 'striking',
    experience_level: 'intermediate',
    duration_min: 60,
    video_url: 'https://www.youtube.com/watch?v=K1TRdN0edmU',
    content: '10 min jump rope\n5×3 min heavy bag w/ 1 min active recovery\n4 rounds: 30s burpees, 30s rest\n3×3 min shadow boxing\n5 min cooldown',
  },
  {
    title: 'Sparring & footwork',
    description: 'Live light-contact sparring with footwork drills.',
    category: 'striking',
    experience_level: 'advanced',
    duration_min: 75,
    video_url: 'https://www.youtube.com/watch?v=4J8clh4MKYE',
    content: '15 min dynamic warmup\n4 rounds light-contact sparring (3 min on, 1 min off)\n3×3 min footwork drills (cone work)\n2×60 sec wall sit\n10 min stretch',
  },
  {
    title: 'Strength — Lower body',
    description: 'Heavy compound lifts targeting legs and posterior chain.',
    category: 'strength',
    experience_level: 'intermediate',
    duration_min: 75,
    goal_alignment: 'maintain,bulk',
    video_url: 'https://www.youtube.com/watch?v=Dy28eq2PjcM',
    content: 'Back squat — 4×6 @ 75-80% 1RM\nRomanian deadlift — 3×8\nWalking lunges — 3×10/leg w/ dumbbells\nLeg curl + calf raise superset — 3×12\n10 min cooldown + foam roll quads/hams',
  },
  {
    title: 'Strength — Upper body',
    description: 'Push and pull volume for upper body hypertrophy.',
    category: 'strength',
    experience_level: 'intermediate',
    duration_min: 65,
    goal_alignment: 'maintain,bulk',
    video_url: 'https://www.youtube.com/watch?v=HE45jVN7XKM',
    content: 'Bench press — 4×6\nBent-over row — 4×8\nOverhead press — 3×8\nPull-ups — 3×AMRAP\nTriceps + biceps superset — 3×12',
  },
  {
    title: 'Strength — Push (heavy)',
    description: 'Bench-focused push session.',
    category: 'strength',
    experience_level: 'advanced',
    duration_min: 70,
    goal_alignment: 'bulk,maintain',
    video_url: 'https://www.youtube.com/watch?v=rxD321l2svE',
    content: 'Bench press — 4×6\nOverhead press — 3×8\nIncline DB press — 3×10\nTriceps dip — 3×AMRAP\nLateral raise — 3×12',
  },
  {
    title: 'Strength — Pull (heavy)',
    description: 'Deadlift + pull-ups, build pulling strength.',
    category: 'strength',
    experience_level: 'advanced',
    duration_min: 70,
    goal_alignment: 'bulk,maintain',
    video_url: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
    content: 'Deadlift — 4×5\nPull-ups — 4×AMRAP (weighted if you can)\nBent-over row — 3×8\nFace pull — 3×15\nBicep curl — 3×10',
  },
  {
    title: 'Grappling — Drilling',
    description: 'Technique-focused grappling session, no live rolling.',
    category: 'grappling',
    experience_level: 'beginner',
    duration_min: 60,
    video_url: 'https://www.youtube.com/watch?v=OWEzn1xq0Jc',
    content: '10 min mobility + neck warmup\n20 min technique drilling (focus position)\n5×3 min positional rolls\n3×30 sec hip escape drill\n10 min cooldown stretch',
  },
  {
    title: 'Grappling — Live rolling',
    description: '6 hard rounds of live rolling. Bring water.',
    category: 'grappling',
    experience_level: 'intermediate',
    duration_min: 60,
    video_url: 'https://www.youtube.com/watch?v=6TT6h6jAKn4',
    content: '10 min dynamic warmup\n6 rounds 5 min live rolling\n5 min cooldown stretching',
  },
  {
    title: 'Conditioning circuit',
    description: 'For-time circuit blending lifting + cardio.',
    category: 'conditioning',
    experience_level: 'intermediate',
    duration_min: 30,
    goal_alignment: 'cut,maintain',
    video_url: 'https://www.youtube.com/watch?v=ml6cT4AZdqI',
    content: '5 rounds for time:\n  • 20 burpees\n  • 15 box jumps\n  • 10 dumbbell snatches/arm\n  • 200m run\nGoal: under 25 min for intermediate, under 20 advanced',
  },
  {
    title: 'Cardio — Steady state',
    description: 'Zone-2 endurance work for aerobic base.',
    category: 'cardio',
    experience_level: 'beginner',
    duration_min: 45,
    goal_alignment: 'cut,maintain',
    video_url: 'https://www.youtube.com/watch?v=5umbf4ps0GQ',
    content: '30-45 min steady-state run @ 70% max HR\nOR 20 min interval bike (1 min hard, 1 min easy)\n10 min cooldown walk',
  },
  {
    title: 'Cardio + mobility',
    description: 'Light cardio paired with full-body mobility.',
    category: 'recovery',
    experience_level: 'beginner',
    duration_min: 50,
    video_url: 'https://www.youtube.com/watch?v=lPKRiU9u_Hc',
    content: '20 min easy zone-2 cardio (bike or row)\n20 min full-body mobility flow\n10 min stretch / breathwork',
  },
  {
    title: 'Active recovery walk',
    description: 'Easy movement, hydration, mobility.',
    category: 'recovery',
    experience_level: 'beginner',
    duration_min: 45,
    video_url: 'https://www.youtube.com/watch?v=7MZ5w6Xl7J0',
    content: 'Light walk 30-45 min\n15 min mobility flow (CARs)\nOptional: sauna or contrast shower',
  },
  {
    title: 'HIIT bag intervals',
    description: 'Short, brutal intervals for fight-week sharpness.',
    category: 'striking',
    experience_level: 'advanced',
    duration_min: 35,
    goal_alignment: 'cut,maintain',
    video_url: 'https://www.youtube.com/watch?v=I-8L6W7oY3c',
    content: '10 min warmup (jump rope + shadow box)\n8 rounds: 20s all-out heavy bag, 40s rest\n3 rounds: 30s burpees, 30s rest\n5 min cooldown',
  },
  {
    title: 'Beginner full-body strength',
    description: 'Foundational lifts for new athletes.',
    category: 'strength',
    experience_level: 'beginner',
    duration_min: 50,
    video_url: 'https://www.youtube.com/watch?v=U0bhE67HuDY',
    content: 'Goblet squat — 3×10\nDumbbell bench press — 3×10\nOne-arm row — 3×10/side\nGlute bridge — 3×12\nPlank — 3×30s',
  },
];

async function seedWorkoutLibrary() {
  const [count] = await pool.query('SELECT COUNT(*) AS c FROM workout_library');
  if (count[0].c === 0) {
    for (const w of WORKOUT_LIBRARY_SEEDS) {
      await pool.query(
        `INSERT INTO workout_library
          (title, description, content, video_url, category, experience_level, duration_min, goal_alignment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          w.title,
          w.description || '',
          w.content || '',
          w.video_url || null,
          w.category,
          w.experience_level || 'intermediate',
          w.duration_min || 60,
          w.goal_alignment || 'cut,maintain,bulk',
        ]
      );
    }
    return;
  }
  // Library already exists — backfill video_url for any rows missing one so
  // existing installs pick up new YouTube links without a destructive reset.
  for (const w of WORKOUT_LIBRARY_SEEDS) {
    if (!w.video_url) continue;
    await pool.query(
      `UPDATE workout_library
         SET video_url = ?
       WHERE title = ? AND (video_url IS NULL OR video_url = '')`,
      [w.video_url, w.title]
    );
  }
}

const MEAL_LIBRARY_SEEDS = [
  // ── Breakfast ───────────────────────────────────────
  { title: 'Egg-white scramble + oats', meal_type: 'breakfast', calories: 420, protein_g: 38, carbs_g: 50, fat_g: 8, goal_alignment: 'cut,maintain', dietary_tag: 'vegetarian', prep_minutes: 12, ingredients: '6 egg whites, 1 cup oats, 1 cup berries, cinnamon' },
  { title: 'Greek yogurt parfait', meal_type: 'breakfast', calories: 380, protein_g: 32, carbs_g: 45, fat_g: 8, goal_alignment: 'cut,maintain,bulk', dietary_tag: 'vegetarian', prep_minutes: 5, ingredients: '1.5 cup nonfat Greek yogurt, 1/3 cup granola, banana, honey' },
  { title: 'Whole-egg veggie omelet', meal_type: 'breakfast', calories: 480, protein_g: 30, carbs_g: 18, fat_g: 30, goal_alignment: 'cut,maintain', dietary_tag: 'vegetarian', prep_minutes: 10, ingredients: '4 whole eggs, spinach, mushrooms, feta, avocado' },
  { title: 'Protein smoothie bowl', meal_type: 'breakfast', calories: 520, protein_g: 40, carbs_g: 70, fat_g: 8, goal_alignment: 'maintain,bulk', dietary_tag: 'vegetarian', prep_minutes: 5, ingredients: '1 scoop whey, banana, berries, almond milk, oats, peanut butter' },
  { title: 'Steel-cut oats + chicken sausage', meal_type: 'breakfast', calories: 560, protein_g: 35, carbs_g: 65, fat_g: 14, goal_alignment: 'maintain,bulk', dietary_tag: 'none', prep_minutes: 15, ingredients: '1 cup steel-cut oats, 2 chicken sausage links, blueberries, walnuts' },
  { title: 'Tofu scramble + sourdough', meal_type: 'breakfast', calories: 440, protein_g: 28, carbs_g: 50, fat_g: 14, goal_alignment: 'cut,maintain', dietary_tag: 'vegan', prep_minutes: 12, ingredients: 'Firm tofu, turmeric, peppers, sourdough toast, nutritional yeast' },
  { title: 'Salmon + bagel', meal_type: 'breakfast', calories: 620, protein_g: 38, carbs_g: 60, fat_g: 24, goal_alignment: 'maintain,bulk', dietary_tag: 'kosher', prep_minutes: 5, ingredients: 'Whole-grain bagel, smoked salmon, light cream cheese, capers' },

  // ── Lunch ───────────────────────────────────────────
  { title: 'Grilled chicken + quinoa bowl', meal_type: 'lunch', calories: 580, protein_g: 50, carbs_g: 55, fat_g: 16, goal_alignment: 'cut,maintain,bulk', dietary_tag: 'halal', prep_minutes: 25, ingredients: '6 oz grilled chicken, 1 cup quinoa, mixed greens, olive oil, lemon' },
  { title: 'Tuna poke bowl', meal_type: 'lunch', calories: 520, protein_g: 42, carbs_g: 60, fat_g: 12, goal_alignment: 'cut,maintain', dietary_tag: 'kosher', prep_minutes: 15, ingredients: 'Sushi-grade tuna, brown rice, edamame, cucumber, soy sauce, sesame' },
  { title: 'Turkey burrito bowl', meal_type: 'lunch', calories: 640, protein_g: 48, carbs_g: 65, fat_g: 18, goal_alignment: 'maintain,bulk', dietary_tag: 'halal', prep_minutes: 20, ingredients: 'Lean ground turkey, black beans, brown rice, salsa, light cheese, lettuce' },
  { title: 'Lentil + chickpea power bowl', meal_type: 'lunch', calories: 540, protein_g: 28, carbs_g: 78, fat_g: 14, goal_alignment: 'cut,maintain,bulk', dietary_tag: 'vegan', prep_minutes: 20, ingredients: '1 cup lentils, 1/2 cup chickpeas, kale, sweet potato, tahini' },
  { title: 'Steak fajita salad', meal_type: 'lunch', calories: 560, protein_g: 45, carbs_g: 30, fat_g: 28, goal_alignment: 'cut,maintain', dietary_tag: 'halal', prep_minutes: 20, ingredients: '5 oz flank steak, peppers, onions, romaine, avocado, lime' },
  { title: 'Cottage cheese + tuna plate', meal_type: 'lunch', calories: 380, protein_g: 50, carbs_g: 14, fat_g: 12, goal_alignment: 'cut', dietary_tag: 'kosher', prep_minutes: 5, ingredients: '1 cup cottage cheese, 1 can tuna, cucumber, tomato, olive oil' },
  { title: 'Chicken caesar wrap', meal_type: 'lunch', calories: 600, protein_g: 42, carbs_g: 55, fat_g: 22, goal_alignment: 'maintain,bulk', dietary_tag: 'halal', prep_minutes: 10, ingredients: 'Whole-wheat wrap, grilled chicken, romaine, light caesar, parmesan' },

  // ── Dinner ──────────────────────────────────────────
  { title: 'Salmon + sweet potato', meal_type: 'dinner', calories: 620, protein_g: 45, carbs_g: 50, fat_g: 24, goal_alignment: 'cut,maintain,bulk', dietary_tag: 'kosher', prep_minutes: 25, ingredients: '6 oz salmon, 1 medium sweet potato, asparagus, olive oil' },
  { title: 'Lean beef stir-fry', meal_type: 'dinner', calories: 650, protein_g: 48, carbs_g: 60, fat_g: 22, goal_alignment: 'maintain,bulk', dietary_tag: 'halal', prep_minutes: 20, ingredients: '6 oz sirloin, broccoli, peppers, brown rice, soy + garlic' },
  { title: 'Chicken + rice + broccoli', meal_type: 'dinner', calories: 560, protein_g: 50, carbs_g: 65, fat_g: 8, goal_alignment: 'cut,maintain,bulk', dietary_tag: 'halal', prep_minutes: 20, ingredients: '6 oz chicken breast, 1 cup jasmine rice, steamed broccoli' },
  { title: 'Shrimp + zoodles', meal_type: 'dinner', calories: 380, protein_g: 38, carbs_g: 18, fat_g: 16, goal_alignment: 'cut', dietary_tag: 'kosher', prep_minutes: 15, ingredients: '8 oz shrimp, zucchini noodles, marinara, olive oil, garlic' },
  { title: 'Tofu pad thai', meal_type: 'dinner', calories: 580, protein_g: 28, carbs_g: 70, fat_g: 18, goal_alignment: 'maintain,bulk', dietary_tag: 'vegan', prep_minutes: 25, ingredients: 'Firm tofu, rice noodles, peanuts, lime, scallions, tamari' },
  { title: 'Lamb kabobs + couscous', meal_type: 'dinner', calories: 720, protein_g: 45, carbs_g: 55, fat_g: 32, goal_alignment: 'maintain,bulk', dietary_tag: 'halal', prep_minutes: 30, ingredients: '6 oz lamb, couscous, cucumber, tomato, mint, yogurt' },
  { title: 'Chickpea curry + basmati', meal_type: 'dinner', calories: 540, protein_g: 22, carbs_g: 80, fat_g: 14, goal_alignment: 'cut,maintain,bulk', dietary_tag: 'vegan', prep_minutes: 25, ingredients: 'Chickpeas, coconut milk, tomatoes, basmati rice, spinach' },
  { title: 'Cod + potato hash', meal_type: 'dinner', calories: 480, protein_g: 38, carbs_g: 45, fat_g: 14, goal_alignment: 'cut,maintain', dietary_tag: 'kosher', prep_minutes: 25, ingredients: '6 oz cod, baby potatoes, peppers, onions, paprika' },

  // ── Snack ───────────────────────────────────────────
  { title: 'Whey shake + banana', meal_type: 'snack', calories: 300, protein_g: 30, carbs_g: 35, fat_g: 4, goal_alignment: 'cut,maintain,bulk', dietary_tag: 'vegetarian', prep_minutes: 2, ingredients: '1 scoop whey, 1 banana, water or milk' },
  { title: 'Cottage cheese + pineapple', meal_type: 'snack', calories: 220, protein_g: 25, carbs_g: 20, fat_g: 4, goal_alignment: 'cut,maintain', dietary_tag: 'kosher', prep_minutes: 2, ingredients: '1 cup cottage cheese, fresh pineapple chunks' },
  { title: 'Apple + almond butter', meal_type: 'snack', calories: 280, protein_g: 8, carbs_g: 30, fat_g: 16, goal_alignment: 'cut,maintain,bulk', dietary_tag: 'vegan', prep_minutes: 1, ingredients: '1 apple, 2 tbsp almond butter' },
  { title: 'Protein oats jar', meal_type: 'snack', calories: 380, protein_g: 30, carbs_g: 50, fat_g: 6, goal_alignment: 'maintain,bulk', dietary_tag: 'vegetarian', prep_minutes: 5, ingredients: '1/2 cup oats, 1 scoop whey, almond milk, chia seeds, blueberries' },
  { title: 'Hard-boiled eggs + fruit', meal_type: 'snack', calories: 240, protein_g: 18, carbs_g: 18, fat_g: 12, goal_alignment: 'cut,maintain', dietary_tag: 'vegetarian', prep_minutes: 0, ingredients: '3 hard-boiled eggs, 1 cup grapes' },
  { title: 'Hummus + veggies', meal_type: 'snack', calories: 220, protein_g: 8, carbs_g: 24, fat_g: 12, goal_alignment: 'cut,maintain', dietary_tag: 'vegan', prep_minutes: 5, ingredients: '1/3 cup hummus, carrots, celery, bell pepper' },
  { title: 'Beef jerky + trail mix', meal_type: 'snack', calories: 360, protein_g: 22, carbs_g: 30, fat_g: 16, goal_alignment: 'maintain,bulk', dietary_tag: 'halal', prep_minutes: 0, ingredients: '1.5 oz beef jerky, 1/4 cup trail mix' },
  { title: 'Rice cakes + tuna', meal_type: 'snack', calories: 240, protein_g: 25, carbs_g: 28, fat_g: 4, goal_alignment: 'cut', dietary_tag: 'kosher', prep_minutes: 3, ingredients: '2 rice cakes, 1 can tuna, mustard' },
];

async function seedMealLibrary() {
  const [count] = await pool.query('SELECT COUNT(*) AS c FROM meal_library');
  if (count[0].c > 0) return;
  for (const m of MEAL_LIBRARY_SEEDS) {
    await pool.query(
      `INSERT INTO meal_library
        (title, description, meal_type, calories, protein_g, carbs_g, fat_g, goal_alignment, dietary_tag, prep_minutes, ingredients)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.title,
        m.description || '',
        m.meal_type,
        m.calories,
        m.protein_g,
        m.carbs_g,
        m.fat_g,
        m.goal_alignment || 'cut,maintain,bulk',
        m.dietary_tag || 'none',
        m.prep_minutes || 15,
        m.ingredients || null,
      ]
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
