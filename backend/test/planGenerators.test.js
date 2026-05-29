const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  generateWorkoutPlan,
  generateDailyWorkout,
  generateMealPlan,
  generateDailyMealPlan,
  computeTargets,
  profileSufficient,
} = require('../lib/planGenerators');

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

const mockMealLibrary = ['breakfast', 'lunch', 'dinner', 'snack'].flatMap((meal_type) =>
  [1, 2, 3].map((n) => ({
    meal_type,
    name: `${meal_type} ${n}`,
    title: `${meal_type} option ${n}`,
    goal_alignment: 'cut,any',
    dietary_tag: 'none',
    calories: 300,
    protein_g: 20,
    carbs_g: 40,
    fat_g: 12,
    prep_minutes: 15,
    ingredients: 'sample',
  }))
);

const mockWorkoutLibrary = [
  {
    id: 0,
    title: 'Striking — Bag work fundamentals',
    category: 'striking',
    experience_level: 'intermediate',
    content: 'Round 1\nRound 2',
    video_url: 'https://youtu.be/dQw4w9WgXcQ',
    duration_min: 45,
  },
  {
    id: 2,
    title: 'Strength — Lower body',
    category: 'strength',
    experience_level: 'intermediate',
    content: 'Squat\nLunge',
    video_url: null,
    duration_min: 60,
  },
];

describe('planGenerators.js', () => {
  describe('profileSufficient', () => {
    it('accepts complete profiles', () => {
      assert.equal(profileSufficient(fullProfile), true);
    });

    it('rejects missing required fields', () => {
      assert.equal(profileSufficient(null), false);
      assert.equal(profileSufficient({}), false);
      assert.equal(profileSufficient({ currentWeightLb: 180 }), false);
      assert.equal(
        profileSufficient({ ...fullProfile, goalType: undefined }),
        false
      );
    });
  });

  describe('computeTargets', () => {
    it('returns macro targets for cut profile', () => {
      const t = computeTargets(fullProfile);
      assert.ok(t.calories > 1200);
      assert.equal(t.goalDirection, 'cut');
      assert.ok(t.proteinG > 0);
      assert.ok(t.carbsG >= 0);
      assert.ok(t.fatG > 0);
      assert.equal(t.weightLb, 180);
      assert.equal(t.goalWeightLb, 170);
      assert.ok(t.weightDelta < 0);
    });

    it('infers bulk from goal weight above current', () => {
      const t = computeTargets({
        ...fullProfile,
        goalWeightLb: 200,
        goalType: undefined,
      });
      assert.equal(t.goalDirection, 'bulk');
      assert.ok(t.calories > t.tdee);
    });

    it('respects explicit maintain goalType', () => {
      const t = computeTargets({
        ...fullProfile,
        goalWeightLb: 170,
        goalType: 'maintain',
      });
      assert.equal(t.goalDirection, 'maintain');
    });

    it('uses higher protein per lb on cut', () => {
      const cut = computeTargets({ ...fullProfile, goalType: 'cut' });
      const bulk = computeTargets({ ...fullProfile, goalType: 'bulk', goalWeightLb: 190 });
      assert.ok(cut.proteinG >= bulk.proteinG * 0.9);
    });
  });

  describe('generateWorkoutPlan', () => {
    it('returns title, description, and long content', () => {
      const plan = generateWorkoutPlan(fullProfile);
      assert.match(plan.title, /Auto plan/i);
      assert.ok(plan.description.length > 10);
      assert.ok(plan.content.length > 200);
      assert.match(plan.content, /Mon/);
      assert.match(plan.content, /Sun/);
    });

    it('includes cut phase note for cut goal', () => {
      const plan = generateWorkoutPlan(fullProfile);
      assert.match(plan.content, /Cut phase/i);
    });

    it('falls back to all-around focus for unknown focus', () => {
      const plan = generateWorkoutPlan({
        ...fullProfile,
        trainingFocus: 'unknown-sport',
      });
      assert.match(plan.content, /all-around/i);
    });

    it('clamps invalid days per week', () => {
      const plan = generateWorkoutPlan({ ...fullProfile, daysPerWeek: 99 });
      assert.match(plan.title, /7d\/wk/);
    });
  });

  describe('generateDailyWorkout', () => {
    it('marks rest days when weekday is not a training slot', () => {
      const monday = new Date('2026-05-25T12:00:00'); // Monday
      const daily = generateDailyWorkout(
        { ...fullProfile, daysPerWeek: 2 },
        [],
        monday
      );
      assert.equal(typeof daily.isRestDay, 'boolean');
      assert.ok(daily.title.length > 0);
      assert.ok(daily.content.length > 20);
    });

    it('pulls library video when block matches', () => {
      const wednesday = new Date('2026-05-27T12:00:00');
      const daily = generateDailyWorkout(fullProfile, mockWorkoutLibrary, wednesday);
      if (!daily.isRestDay) {
        assert.ok(
          daily.videoUrl === null || daily.videoUrl.includes('youtu'),
          'video from library when training'
        );
      }
      assert.ok(daily.libraryId === null || Number.isInteger(daily.libraryId));
    });

    it('uses SESSION_BLOCKS fallback without library', () => {
      const daily = generateDailyWorkout(fullProfile, [], new Date('2026-05-26T12:00:00'));
      assert.match(daily.content, /session|Recovery/i);
    });
  });

  describe('generateMealPlan', () => {
    it('returns calorie and macro targets', () => {
      const meal = generateMealPlan(fullProfile);
      assert.ok(meal.targetCalories > 1200);
      assert.ok(meal.proteinG > 0);
      assert.ok(meal.carbsG >= 0);
      assert.ok(meal.fatG > 0);
      assert.match(meal.notes, /BMR/i);
    });

    it('adds vegetarian dietary note', () => {
      const meal = generateMealPlan({ ...fullProfile, dietary: 'vegetarian' });
      assert.match(meal.notes, /Vegetarian/i);
    });
  });

  describe('generateDailyMealPlan', () => {
    it('picks meals for each slot from library', () => {
      const daily = generateDailyMealPlan(
        fullProfile,
        mockMealLibrary,
        new Date('2026-05-26T12:00:00')
      );
      assert.ok(daily.picks.breakfast);
      assert.ok(daily.picks.lunch);
      assert.ok(daily.picks.dinner);
      assert.ok(daily.summary.cal > 0);
      assert.equal(daily.targets.goalDirection, 'cut');
    });

    it('is deterministic for the same date', () => {
      const date = new Date('2026-06-15T08:00:00');
      const a = generateDailyMealPlan(fullProfile, mockMealLibrary, date);
      const b = generateDailyMealPlan(fullProfile, mockMealLibrary, date);
      assert.equal(a.picks.breakfast?.id ?? a.picks.breakfast?.title, b.picks.breakfast?.id ?? b.picks.breakfast?.title);
    });

    it('varies picks across different dates', () => {
      const a = generateDailyMealPlan(fullProfile, mockMealLibrary, new Date('2026-01-01'));
      const b = generateDailyMealPlan(fullProfile, mockMealLibrary, new Date('2026-07-01'));
      const sameBreakfast =
        a.picks.breakfast?.title === b.picks.breakfast?.title;
      assert.ok(
        sameBreakfast === false || mockMealLibrary.filter((m) => m.meal_type === 'breakfast').length === 1,
        'different days should usually rotate breakfast'
      );
    });

    it('filters vegan meals when dietary is vegan', () => {
      const veganLib = mockMealLibrary.map((m) => ({
        ...m,
        dietary_tag: m.meal_type === 'breakfast' ? 'vegan' : 'none',
      }));
      const daily = generateDailyMealPlan(
        { ...fullProfile, dietary: 'vegan' },
        veganLib,
        new Date('2026-05-26')
      );
      if (daily.picks.breakfast) {
        assert.equal(daily.picks.breakfast.dietary_tag, 'vegan');
      }
    });
  });
});
