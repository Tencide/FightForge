/**
 * Rule-based plan generators that turn a user profile (goals + body comp +
 * preferences) into a workout or meal plan. Pure functions — no DB access.
 */

const FOCUS_DAYS = {
  striking: ['Striking', 'Strength (Lower)', 'Striking & Conditioning', 'Active recovery', 'Sparring & footwork', 'Strength (Upper)', 'Cardio + mobility'],
  grappling: ['Grappling drills', 'Strength (Pull)', 'Live rolling', 'Active recovery', 'Grappling & conditioning', 'Strength (Push)', 'Cardio + mobility'],
  'all-around': ['Striking', 'Strength (Lower)', 'Grappling', 'Active recovery', 'Conditioning circuit', 'Strength (Upper)', 'Cardio + mobility'],
  strength: ['Strength (Lower)', 'Cardio', 'Strength (Push)', 'Active recovery', 'Strength (Pull)', 'Conditioning circuit', 'Cardio + mobility'],
};

const SESSION_BLOCKS = {
  Striking: [
    '10 min jump rope warmup (alternate single + double-unders)',
    '4×3 min heavy bag — jab/cross/hook combos',
    '3×3 min shadow boxing focusing on footwork',
    '3×30 sec speed bag, 30 sec rest',
    '5 min cooldown + neck mobility',
  ],
  'Striking & Conditioning': [
    '10 min jump rope',
    '5×3 min heavy bag w/ 1 min active recovery',
    '4 rounds: 30s burpees, 30s rest',
    '3×3 min shadow boxing',
    '5 min cooldown',
  ],
  'Sparring & footwork': [
    '15 min dynamic warmup',
    '4 rounds light-contact sparring (3 min on, 1 min off)',
    '3×3 min footwork drills (cone work)',
    '2×60 sec wall sit',
    '10 min stretch',
  ],
  'Strength (Lower)': [
    'Back squat — 4×6 @ 75-80% 1RM',
    'Romanian deadlift — 3×8',
    'Walking lunges — 3×10/leg w/ dumbbells',
    'Leg curl + calf raise superset — 3×12',
    '10 min cooldown + foam roll quads/hams',
  ],
  'Strength (Upper)': [
    'Bench press — 4×6',
    'Bent-over row — 4×8',
    'Overhead press — 3×8',
    'Pull-ups — 3×AMRAP',
    'Triceps + biceps superset — 3×12',
  ],
  'Strength (Push)': [
    'Bench press — 4×6',
    'Overhead press — 3×8',
    'Incline DB press — 3×10',
    'Triceps dip — 3×AMRAP',
    'Lateral raise — 3×12',
  ],
  'Strength (Pull)': [
    'Deadlift — 4×5',
    'Pull-ups — 4×AMRAP (weighted if you can)',
    'Bent-over row — 3×8',
    'Face pull — 3×15',
    'Bicep curl — 3×10',
  ],
  Grappling: [
    '10 min mobility + neck warmup',
    '20 min technique drilling (focus position)',
    '5×3 min positional rolls',
    '3×30 sec hip escape drill',
    '10 min cooldown stretch',
  ],
  'Grappling drills': [
    '15 min warmup + breakfalls',
    '20 min specific drilling (takedowns or guard)',
    '4 rounds positional sparring',
    '5 min hip mobility',
  ],
  'Live rolling': [
    '10 min dynamic warmup',
    '6 rounds 5 min live rolling',
    '5 min cooldown stretching',
  ],
  'Conditioning circuit': [
    '5 rounds for time:',
    '  • 20 burpees',
    '  • 15 box jumps',
    '  • 10 dumbbell snatches/arm',
    '  • 200m run',
    'Goal: under 25 min for intermediate, under 20 advanced',
  ],
  Cardio: [
    '30-45 min steady-state run @ 70% max HR',
    'OR 20 min interval bike (1 min hard, 1 min easy)',
    '10 min cooldown walk',
  ],
  'Cardio + mobility': [
    '20 min easy zone-2 cardio (bike or row)',
    '20 min full-body mobility flow',
    '10 min stretch / breathwork',
  ],
  'Active recovery': [
    'Light walk 30-45 min',
    '15 min mobility flow (CARs)',
    'Optional: sauna or contrast shower',
  ],
};

/**
 * Build a 7-day workout plan from a user profile.
 * Returns { title, description, content }.
 */
function generateWorkoutPlan(profile = {}) {
  const goal = ['cut', 'maintain', 'bulk'].includes(profile.goalType)
    ? profile.goalType
    : 'maintain';
  const days = Math.max(3, Math.min(6, Number(profile.daysPerWeek) || 4));
  const focus = FOCUS_DAYS[profile.trainingFocus] ? profile.trainingFocus : 'all-around';
  const exp = ['beginner', 'intermediate', 'advanced'].includes(profile.experienceLevel)
    ? profile.experienceLevel
    : 'intermediate';

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const template = FOCUS_DAYS[focus];

  // Pick training days evenly spread across the week
  const trainSlots = pickTrainingDays(days);
  const restNote = exp === 'beginner'
    ? 'Beginner — keep RPE around 6-7. Add weight only when last set looks clean.'
    : exp === 'advanced'
    ? 'Advanced — push to RPE 8-9 on top sets. Track loads weekly.'
    : 'Intermediate — RPE 7-8 most working sets.';

  const intensityNote = goal === 'cut'
    ? 'Cut phase — keep strength volume, add 1-2 conditioning circuits/week. Calorie deficit will limit recovery, prioritize sleep.'
    : goal === 'bulk'
    ? 'Bulk phase — heavy strength bias, lower-intensity cardio (zone 2). Don\'t skip the mobility days.'
    : 'Maintenance — balanced mix. Use the rest days for skill work or active recovery.';

  const lines = [
    `Goals: ${goal} · ${days} days/week · focus on ${focus} · ${exp} level`,
    '',
    intensityNote,
    restNote,
    '',
    '── Weekly schedule ──',
    '',
  ];

  for (let i = 0; i < 7; i++) {
    const isTraining = trainSlots.has(i);
    const blockName = isTraining ? template[i % template.length] : 'Rest day';
    lines.push(`${dayNames[i]} — ${blockName}`);
    if (isTraining) {
      const block = SESSION_BLOCKS[blockName] || [];
      for (const item of block) {
        lines.push(`  • ${item}`);
      }
    } else {
      lines.push('  • Full recovery — light walking, hydration, mobility (10-15 min)');
    }
    lines.push('');
  }

  const title = `Auto plan: ${capitalize(goal)} (${days}d/wk · ${focus})`;
  const description = `Auto-generated from your profile — adjust the loads to match where you actually are this week.`;

  return { title, description, content: lines.join('\n').trimEnd() };
}

function pickTrainingDays(count) {
  if (count >= 6) return new Set([0, 1, 2, 4, 5, 6]);
  if (count === 5) return new Set([0, 1, 3, 4, 5]);
  if (count === 4) return new Set([0, 1, 3, 5]);
  return new Set([0, 2, 4]);
}

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Map FOCUS_DAYS block names to a preferred workout_library title (or fall
 * back to a category guess). Used by the daily generator to pick a tutorial
 * video + structured content from the library.
 */
const BLOCK_TITLE_ALIASES = {
  'Striking': 'Striking — Bag work fundamentals',
  'Striking & Conditioning': 'Striking & Conditioning',
  'Sparring & footwork': 'Sparring & footwork',
  'Strength (Lower)': 'Strength — Lower body',
  'Strength (Upper)': 'Strength — Upper body',
  'Strength (Push)': 'Strength — Push (heavy)',
  'Strength (Pull)': 'Strength — Pull (heavy)',
  'Grappling': 'Grappling — Drilling',
  'Grappling drills': 'Grappling — Drilling',
  'Live rolling': 'Grappling — Live rolling',
  'Grappling & conditioning': 'Grappling — Live rolling',
  'Conditioning circuit': 'Conditioning circuit',
  'Cardio': 'Cardio — Steady state',
  'Cardio + mobility': 'Cardio + mobility',
  'Active recovery': 'Active recovery walk',
};

function guessCategory(blockName) {
  if (/strength|push|pull|squat|bench|deadlift/i.test(blockName)) return 'strength';
  if (/grappl|rolling|wrestl|bjj/i.test(blockName)) return 'grappling';
  if (/striking|spar|bag|kick|muay|clinch/i.test(blockName)) return 'striking';
  if (/cardio|steady|endurance/i.test(blockName)) return 'cardio';
  if (/condition|circuit|hiit/i.test(blockName)) return 'conditioning';
  if (/recovery|mobility|rest|stretch/i.test(blockName)) return 'recovery';
  return null;
}

function findLibraryMatch(library, blockName, experienceLevel) {
  if (!Array.isArray(library) || library.length === 0) return null;

  // 1. Exact alias match
  const aliasTitle = BLOCK_TITLE_ALIASES[blockName];
  if (aliasTitle) {
    const exact = library.find((w) => w.title === aliasTitle);
    if (exact) return exact;
  }

  // 2. Loose title contains
  const lowered = blockName.toLowerCase();
  const looseTitle = library.find(
    (w) => w.title && w.title.toLowerCase().includes(lowered)
  );
  if (looseTitle) return looseTitle;

  // 3. Category guess + prefer matching experience level
  const cat = guessCategory(blockName);
  if (!cat) return null;
  const inCat = library.filter((w) => w.category === cat);
  if (inCat.length === 0) return null;
  const expMatch = inCat.find((w) => w.experience_level === experienceLevel);
  return expMatch || inCat[0];
}

/**
 * Build a single-session "today's workout" from a user profile, varying by the
 * current day of the week. Used by the "Generate today's workout" button so an
 * athlete can spin up a fresh session in one click.
 *
 * If a `library` array (rows from workout_library) is supplied, the generator
 * will pull the matching tutorial video URL and the curated session content
 * from the library. Otherwise it falls back to the rule-based SESSION_BLOCKS.
 *
 * Returns { title, description, content, videoUrl, isRestDay, libraryId }.
 */
function generateDailyWorkout(profile = {}, library = [], dateOverride) {
  const goal = ['cut', 'maintain', 'bulk'].includes(profile.goalType)
    ? profile.goalType
    : 'maintain';
  const days = Math.max(3, Math.min(6, Number(profile.daysPerWeek) || 4));
  const focus = FOCUS_DAYS[profile.trainingFocus] ? profile.trainingFocus : 'all-around';
  const exp = ['beginner', 'intermediate', 'advanced'].includes(profile.experienceLevel)
    ? profile.experienceLevel
    : 'intermediate';

  const today = dateOverride instanceof Date ? dateOverride : new Date();
  const jsDay = today.getDay(); // 0 = Sun .. 6 = Sat
  const weekIndex = (jsDay + 6) % 7; // 0 = Mon .. 6 = Sun

  const trainSlots = pickTrainingDays(days);
  const isTraining = trainSlots.has(weekIndex);
  const template = FOCUS_DAYS[focus];
  const blockName = isTraining ? template[weekIndex % template.length] : 'Active recovery';

  const libraryMatch = findLibraryMatch(library, blockName, exp);
  const sessionLines = libraryMatch?.content
    ? libraryMatch.content.split(/\r?\n/).filter((s) => s.trim().length > 0)
    : SESSION_BLOCKS[blockName] || [];
  const videoUrl = libraryMatch?.video_url || null;

  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const intensityNote = goal === 'cut'
    ? 'Cut phase — keep intensity high but watch recovery; sleep + hydration matter most.'
    : goal === 'bulk'
    ? 'Bulk phase — push the heavy sets, eat above maintenance, prioritize recovery.'
    : 'Maintenance — quality reps, RPE 7-8 on working sets.';

  const lines = [
    `${dateLabel} — ${blockName}`,
    `Goals: ${goal} · ${exp} · focus on ${focus}`,
  ];
  if (libraryMatch) {
    lines.push(`From library: ${libraryMatch.title} (${libraryMatch.duration_min || 60} min)`);
  }
  lines.push('');
  lines.push(intensityNote);
  lines.push('');
  lines.push(isTraining ? '── Today\'s session ──' : '── Recovery block ──');
  for (const item of sessionLines) {
    // Don't double-bullet items already starting with • or -
    const trimmed = item.trim();
    if (/^[•\-*]/.test(trimmed)) {
      lines.push(`  ${trimmed}`);
    } else {
      lines.push(`  • ${trimmed}`);
    }
  }
  if (!isTraining && sessionLines.length === 0) {
    lines.push('  • Hydrate, eat at maintenance, mobility 10-15 min.');
  }
  if (videoUrl) {
    lines.push('');
    lines.push(`Tutorial video: ${videoUrl}`);
  }

  const title = `${DAY_NAMES_SHORT[weekIndex]} workout — ${blockName}`;
  const description = isTraining
    ? `Auto-generated for ${dateLabel} (${exp} · ${focus}).`
    : `Scheduled rest / active recovery for ${dateLabel}. Light movement only.`;

  return {
    title,
    description,
    content: lines.join('\n').trimEnd(),
    videoUrl,
    isRestDay: !isTraining,
    libraryId: libraryMatch?.id || null,
  };
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Compute calories + macros from a profile.
 * Returns { title, description, targetCalories, proteinG, carbsG, fatG, notes }.
 */
function generateMealPlan(profile = {}) {
  const sex = ['male', 'female', 'other'].includes(profile.sex) ? profile.sex : 'male';
  const age = clampNum(profile.ageYears, 14, 90, 25);
  const heightIn = clampNum(profile.heightIn, 48, 84, 68);
  const weightLb = clampNum(profile.currentWeightLb, 80, 400, 170);
  const days = clampNum(profile.daysPerWeek, 0, 7, 4);
  const goal = ['cut', 'maintain', 'bulk'].includes(profile.goalType)
    ? profile.goalType
    : 'maintain';
  const dietary = profile.dietary || 'none';

  const heightCm = heightIn * 2.54;
  const weightKg = weightLb * 0.453592;

  const sexAdj = sex === 'female' ? -161 : sex === 'other' ? -78 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdj;

  const activityMap = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9];
  const tdee = bmr * activityMap[days];

  let calories;
  if (goal === 'cut') calories = Math.round(tdee - 500);
  else if (goal === 'bulk') calories = Math.round(tdee + 350);
  else calories = Math.round(tdee);

  const proteinPerLb = goal === 'cut' ? 1.1 : 1.0;
  const proteinG = Math.round(weightLb * proteinPerLb);
  const fatG = Math.round(weightLb * (goal === 'cut' ? 0.35 : 0.4));
  const remainingCal = calories - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(remainingCal / 4));

  const notesLines = [
    `BMR: ${Math.round(bmr)} kcal · TDEE: ${Math.round(tdee)} kcal · Goal: ${goal}.`,
    `Protein at ${proteinPerLb} g/lb body weight. Adjust ±200 kcal based on weekly weight trend.`,
  ];

  if (goal === 'cut') {
    notesLines.push('On training days, carb-load around the workout. Save fat for non-training days.');
  } else if (goal === 'bulk') {
    notesLines.push('Aim for slow gain (0.5 lb/week). Add a calorie-dense liquid (whole milk, smoothie) if appetite is the limiter.');
  } else {
    notesLines.push('Re-evaluate every 2-3 weeks. Bump or cut 200 kcal if the scale moves the wrong way.');
  }

  if (dietary === 'vegetarian') {
    notesLines.push('Vegetarian — lean on eggs, dairy, tofu, lentils. Watch B12 and iron.');
  } else if (dietary === 'vegan') {
    notesLines.push('Vegan — combine grains + legumes for complete protein. Supplement B12.');
  } else if (dietary === 'halal') {
    notesLines.push('Halal — chicken, fish, halal red meats. Avoid alcohol-derived flavorings.');
  } else if (dietary === 'kosher') {
    notesLines.push('Kosher — separate meat/dairy. Plenty of fish + parve protein options.');
  }

  const title = `Auto: ${capitalize(goal)} ${calories} kcal`;
  const description = `Auto-generated from your profile (${weightLb} lb, ${heightIn}" tall, ${days} d/wk training).`;

  return {
    title,
    description,
    targetCalories: calories,
    proteinG,
    carbsG,
    fatG,
    notes: notesLines.join('\n'),
  };
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function profileSufficient(profile) {
  if (!profile) return false;
  return Boolean(
    profile.currentWeightLb &&
      profile.heightIn &&
      profile.ageYears &&
      profile.sex &&
      profile.goalType
  );
}

/**
 * Compute calorie + macro targets from a profile, using GOAL WEIGHT to set the
 * trajectory (deficit vs surplus) and to anchor protein.
 *
 *   - goalWeight  < currentWeight  →  cut  (deficit ~500 kcal/day)
 *   - goalWeight  > currentWeight  →  bulk (surplus ~350 kcal/day)
 *   - goalWeight ≈ currentWeight   →  maintain
 *
 * Protein is anchored to `goalWeightLb` (or current if missing) at 1.0–1.1 g/lb.
 */
function computeTargets(profile = {}) {
  const sex = ['male', 'female', 'other'].includes(profile.sex) ? profile.sex : 'male';
  const age = clampNum(profile.ageYears, 14, 90, 25);
  const heightIn = clampNum(profile.heightIn, 48, 84, 68);
  const weightLb = clampNum(profile.currentWeightLb, 80, 400, 170);
  const goalWeightLb = clampNum(profile.goalWeightLb, 80, 400, weightLb);
  const days = clampNum(profile.daysPerWeek, 0, 7, 4);

  const heightCm = heightIn * 2.54;
  const weightKg = weightLb * 0.453592;
  const sexAdj = sex === 'female' ? -161 : sex === 'other' ? -78 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdj;

  const activityMap = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9];
  const tdee = bmr * activityMap[days];

  const weightDelta = goalWeightLb - weightLb;
  let goalDirection;
  if (weightDelta < -2) goalDirection = 'cut';
  else if (weightDelta > 2) goalDirection = 'bulk';
  else goalDirection = 'maintain';

  // Allow explicit profile.goalType to override (so a maintain-weight athlete
  // can still pick "bulk" if they want to recomp).
  if (['cut', 'maintain', 'bulk'].includes(profile.goalType)) {
    goalDirection = profile.goalType;
  }

  let calories;
  if (goalDirection === 'cut') calories = Math.round(tdee - 500);
  else if (goalDirection === 'bulk') calories = Math.round(tdee + 350);
  else calories = Math.round(tdee);

  const proteinPerLb = goalDirection === 'cut' ? 1.1 : 1.0;
  const proteinG = Math.round(goalWeightLb * proteinPerLb);
  const fatG = Math.round(weightLb * (goalDirection === 'cut' ? 0.35 : 0.4));
  const remainingCal = calories - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(remainingCal / 4));

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goalDirection,
    weightLb,
    goalWeightLb,
    weightDelta,
  };
}

/**
 * Build a "today's meals" plan from the profile + a library of meals.
 * Picks one breakfast, lunch, dinner, and snack that:
 *   - match the goal (cut / maintain / bulk)
 *   - respect dietary preferences
 *   - sum to roughly the calorie target
 * Varies by day-of-week so the same person doesn't see the same plan daily.
 *
 * @param {object} profile         user profile JSON
 * @param {Array}  libraryMeals    rows from meal_library
 * @param {Date}   [dateOverride]  pin generation to a specific date (tests)
 */
function generateDailyMealPlan(profile = {}, libraryMeals = [], dateOverride) {
  const targets = computeTargets(profile);
  const today = dateOverride instanceof Date ? dateOverride : new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const dietary = profile.dietary || 'none';

  const matchesDietary = (m) => {
    if (dietary === 'none') return true;
    if (dietary === 'vegan') return m.dietary_tag === 'vegan';
    if (dietary === 'vegetarian') return ['vegetarian', 'vegan'].includes(m.dietary_tag);
    if (dietary === 'halal') return ['halal', 'kosher', 'vegan', 'vegetarian'].includes(m.dietary_tag) || m.dietary_tag === 'none';
    if (dietary === 'kosher') return ['kosher', 'vegan', 'vegetarian'].includes(m.dietary_tag) || m.dietary_tag === 'none';
    return true;
  };

  const matchesGoal = (m) => {
    const tags = String(m.goal_alignment || '').split(',').map((s) => s.trim());
    return tags.includes(targets.goalDirection) || tags.includes('any');
  };

  const candidatesByType = {
    breakfast: libraryMeals.filter((m) => m.meal_type === 'breakfast' && matchesGoal(m) && matchesDietary(m)),
    lunch: libraryMeals.filter((m) => m.meal_type === 'lunch' && matchesGoal(m) && matchesDietary(m)),
    dinner: libraryMeals.filter((m) => m.meal_type === 'dinner' && matchesGoal(m) && matchesDietary(m)),
    snack: libraryMeals.filter((m) => m.meal_type === 'snack' && matchesGoal(m) && matchesDietary(m)),
  };

  // Use a deterministic-but-rotating index per day-of-year so each day
  // surfaces a different combination from the library.
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const pickFor = (type, salt) => {
    const list = candidatesByType[type];
    if (!list || list.length === 0) {
      const fallback = libraryMeals.filter((m) => m.meal_type === type);
      if (fallback.length === 0) return null;
      return fallback[(dayOfYear + salt) % fallback.length];
    }
    return list[(dayOfYear + salt) % list.length];
  };

  const breakfast = pickFor('breakfast', 0);
  const lunch = pickFor('lunch', 1);
  const dinner = pickFor('dinner', 2);
  const snack = pickFor('snack', 3);

  const picks = [breakfast, lunch, dinner, snack].filter(Boolean);
  const sum = picks.reduce(
    (acc, m) => ({
      cal: acc.cal + (m.calories || 0),
      p: acc.p + (m.protein_g || 0),
      c: acc.c + (m.carbs_g || 0),
      f: acc.f + (m.fat_g || 0),
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );

  // Build the markdown-ish content body.
  const lines = [
    `${dateLabel} — ${capitalize(targets.goalDirection)} day`,
    `Target: ~${targets.calories} kcal · P ${targets.proteinG}g / C ${targets.carbsG}g / F ${targets.fatG}g`,
    `Anchored to goal weight ${targets.goalWeightLb} lb (current ${targets.weightLb} lb)`,
    '',
  ];
  const slots = [
    ['🥣  Breakfast', breakfast],
    ['🥗  Lunch', lunch],
    ['🍱  Dinner', dinner],
    ['🍎  Snack', snack],
  ];
  for (const [label, meal] of slots) {
    if (!meal) {
      lines.push(`${label}: (no library match — add one in your meal library)`);
      lines.push('');
      continue;
    }
    lines.push(`${label}: ${meal.title}`);
    lines.push(`   ${meal.calories} kcal · P ${meal.protein_g}g / C ${meal.carbs_g}g / F ${meal.fat_g}g · ${meal.prep_minutes} min`);
    if (meal.ingredients) lines.push(`   ${meal.ingredients}`);
    lines.push('');
  }

  lines.push('── Day total ──');
  lines.push(`${sum.cal} kcal · P ${sum.p}g / C ${sum.c}g / F ${sum.f}g`);
  const calDelta = sum.cal - targets.calories;
  if (Math.abs(calDelta) > 200) {
    lines.push(
      calDelta > 0
        ? `(${calDelta} kcal over target — drop a snack or trim portions)`
        : `(${Math.abs(calDelta)} kcal under — add a snack or extra serving of carbs)`
    );
  }

  const title = `${dateLabel.split(',')[0]} meals — ${capitalize(targets.goalDirection)}`;
  const description = `Auto-generated for ${dateLabel}. ${targets.goalDirection === 'cut' ? 'Cutting' : targets.goalDirection === 'bulk' ? 'Bulking' : 'Maintaining'} toward ${targets.goalWeightLb} lb.`;

  return {
    title,
    description,
    targetCalories: targets.calories,
    proteinG: targets.proteinG,
    carbsG: targets.carbsG,
    fatG: targets.fatG,
    notes: lines.join('\n').trimEnd(),
    picks: { breakfast, lunch, dinner, snack },
    summary: sum,
    targets,
  };
}

module.exports = {
  generateWorkoutPlan,
  generateDailyWorkout,
  generateMealPlan,
  generateDailyMealPlan,
  computeTargets,
  profileSufficient,
};
