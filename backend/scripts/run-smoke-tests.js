/**
 * FightForge smoke + unit tests (no test framework required).
 * Usage: node scripts/run-smoke-tests.js [API_BASE_URL]
 * Default API: https://fightforge-api.fly.dev
 */
const {
  generateWorkoutPlan,
  generateDailyWorkout,
  generateMealPlan,
  generateDailyMealPlan,
  computeTargets,
  profileSufficient,
} = require('../lib/planGenerators');
const { getYouTubeId, classifyVideoUrl } = require('../lib/youtube');

const API_BASE = (process.argv[2] || process.env.API_BASE || 'https://fightforge-api.fly.dev').replace(
  /\/$/,
  ''
);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed += 1;
  console.error(`  ✗ ${name}`);
  if (detail) console.error(`    ${detail}`);
}

function assert(name, condition, detail) {
  if (condition) ok(name);
  else fail(name, detail);
}

function section(title) {
  console.log(`\n## ${title}`);
}

// --- Unit: YouTube ---
section('Unit: youtube.js');
assert('bare 11-char id', getYouTubeId('dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('youtu.be', getYouTubeId('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('watch URL', getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('shorts URL', getYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('invalid returns null', getYouTubeId('not-a-url') === null);
const ytClass = classifyVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert('classify youtube', ytClass && ytClass.kind === 'youtube' && ytClass.youtubeId === 'dQw4w9WgXcQ');
const mp4Class = classifyVideoUrl('https://cdn.example.com/clip.mp4');
assert('classify mp4 direct', mp4Class && mp4Class.kind === 'direct');

// --- Unit: planGenerators ---
section('Unit: planGenerators.js');
const fullProfile = {
  currentWeightLb: 180,
  goalWeightLb: 170,
  heightIn: 70,
  ageYears: 28,
  sex: 'male',
  goalType: 'cut',
  daysPerWeek: 4,
  trainingFocus: 'all-around',
  experienceLevel: 'intermediate',
  dietary: 'none',
};
assert('profileSufficient full', profileSufficient(fullProfile) === true);
assert('profileSufficient incomplete', profileSufficient({ currentWeightLb: 180 }) === false);
const targets = computeTargets(fullProfile);
assert('computeTargets calories', typeof targets.calories === 'number' && targets.calories > 1200);
assert('cut direction', targets.goalDirection === 'cut');
const plan = generateWorkoutPlan(fullProfile);
assert('workout plan content', typeof plan.content === 'string' && plan.content.length > 50);
const daily = generateDailyWorkout(fullProfile, new Date('2026-05-26'));
assert('daily workout title', typeof daily.title === 'string' && daily.title.length > 0);
const mealPlan = generateMealPlan(fullProfile);
assert('meal plan macros', mealPlan.proteinG > 0 && mealPlan.carbsG > 0);
const mockLibrary = ['breakfast', 'lunch', 'dinner', 'snack'].flatMap((meal_type) =>
  [1, 2].map((n) => ({
    meal_type,
    name: `${meal_type} ${n}`,
    goal_alignment: 'cut,any',
    dietary_tag: 'none',
    calories: 400,
    protein_g: 30,
    carbs_g: 40,
    fat_g: 12,
  }))
);
const dailyMeal = generateDailyMealPlan(fullProfile, mockLibrary, new Date('2026-05-26'));
assert('daily meal picks', dailyMeal.picks && dailyMeal.picks.breakfast);

// --- API smoke ---
async function apiJson(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { _raw: text.slice(0, 200) };
    }
  }
  return { status: res.status, data };
}

async function runApiTests() {
  section(`API smoke: ${API_BASE}`);

  const health = await apiJson('GET', '/api/health');
  assert('GET /api/health 200', health.status === 200 && health.data?.ok === true, JSON.stringify(health));

  const root = await apiJson('GET', '/');
  assert('GET / 200', root.status === 200 && root.data?.service === 'fightforge-api');

  const badLogin = await apiJson('POST', '/api/auth/login', {
    body: { email: 'nobody@fightforge.test', password: 'wrong' },
  });
  assert('login invalid creds 401', badLogin.status === 401);

  const missingLogin = await apiJson('POST', '/api/auth/login', { body: { email: 'x@test.com' } });
  assert('login missing password 400', missingLogin.status === 400);

  const noAuth = await apiJson('GET', '/api/workouts');
  assert('workouts without token 401', noAuth.status === 401);

  const demoAccounts = [
    { label: 'athlete', email: 'athlete@fightforge.test', password: 'Password123!' },
    { label: 'coach', email: 'coach@fightforge.test', password: 'Password123!' },
    { label: 'admin', email: 'admin@fightforge.test', password: 'Password123!' },
  ];

  let authedToken = null;
  let authedUser = null;
  for (const acct of demoAccounts) {
    const login = await apiJson('POST', '/api/auth/login', {
      body: { email: acct.email, password: acct.password },
    });
    if (login.status === 200 && login.data?.token) {
      ok(`${acct.label} demo login`);
      if (!authedToken) {
        authedToken = login.data.token;
        authedUser = login.data.user;
      }
    } else {
      fail(
        `${acct.label} demo login`,
        `status ${login.status} — seed users may be missing on this API (${login.data?.error || 'no token'})`
      );
    }
  }

  if (!authedToken) {
    fail('authenticated route suite', 'skipped — no demo token (run seed against this API)');
    return;
  }

  const authed = (method, path, opts = {}) => apiJson(method, path, { ...opts, token: authedToken });

  const workouts = await authed('GET', '/api/workouts');
  assert('GET /api/workouts', workouts.status === 200 && Array.isArray(workouts.data), String(workouts.status));

  const meals = await authed('GET', '/api/meals');
  assert('GET /api/meals', meals.status === 200, String(meals.status));

  const friends = await authed('GET', '/api/friends');
  assert('GET /api/friends', friends.status === 200, String(friends.status));

  const reels = await authed('GET', '/api/reels');
  assert('GET /api/reels', reels.status === 200, String(reels.status));

  const messages = await authed('GET', '/api/messages');
  assert('GET /api/messages', messages.status === 200, String(messages.status));

  const userId = authedUser?.id;
  if (userId) {
    const prof = await authed('GET', `/api/auth/profile/${userId}`);
    assert('GET /api/auth/profile/:id', prof.status === 200 && prof.data?.email, String(prof.status));

    const progress = await authed('GET', `/api/progress/${userId}`);
    assert('GET /api/progress/:userId', progress.status === 200, String(progress.status));
  } else {
    fail('GET /api/auth/profile/:id', 'no user id from login');
  }

  const notFound = await authed('GET', '/api/nope-route');
  assert('unknown route 404', notFound.status === 404);
}

const skipApi =
  process.env.SKIP_API === '1' ||
  process.env.SKIP_API === 'true' ||
  process.argv.includes('--unit-only');

(async () => {
  console.log('FightForge test run\n');
  if (skipApi) {
    console.log('(API smoke skipped — SKIP_API or --unit-only)\n');
  } else {
    try {
      await runApiTests();
    } catch (err) {
      fail('API suite threw', err.message);
    }
  }

  section('Summary');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
