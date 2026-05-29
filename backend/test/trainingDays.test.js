const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  MIN_TRAINING_DAYS,
  MAX_TRAINING_DAYS,
  DEFAULT_TRAINING_DAYS,
  clampTrainingDays,
  pickTrainingDayIndexes,
  activityMultiplierForTrainingDays,
  describeTrainingWeek,
} = require('../lib/trainingDays');

describe('trainingDays.js', () => {
  describe('clampTrainingDays', () => {
    it('clamps below minimum to 2', () => {
      assert.equal(clampTrainingDays(0), MIN_TRAINING_DAYS);
      assert.equal(clampTrainingDays(1), MIN_TRAINING_DAYS);
      assert.equal(clampTrainingDays(-5), MIN_TRAINING_DAYS);
    });

    it('clamps above maximum to 7', () => {
      assert.equal(clampTrainingDays(8), MAX_TRAINING_DAYS);
      assert.equal(clampTrainingDays(99), MAX_TRAINING_DAYS);
    });

    it('rounds fractional values', () => {
      assert.equal(clampTrainingDays(4.6), 5);
      assert.equal(clampTrainingDays(3.2), 3);
    });

    it('uses default for non-finite input', () => {
      assert.equal(clampTrainingDays(NaN), DEFAULT_TRAINING_DAYS);
      assert.equal(clampTrainingDays('nope'), DEFAULT_TRAINING_DAYS);
      assert.equal(clampTrainingDays(undefined), DEFAULT_TRAINING_DAYS);
    });
  });

  describe('pickTrainingDayIndexes', () => {
    it('returns a Set with correct size for each pattern', () => {
      for (let n = MIN_TRAINING_DAYS; n <= MAX_TRAINING_DAYS; n += 1) {
        const set = pickTrainingDayIndexes(n);
        assert.equal(set.size, n);
        for (const idx of set) {
          assert.ok(idx >= 0 && idx <= 6, `index ${idx} out of range for ${n} days`);
        }
      }
    });

    it('4-day pattern matches Mon Tue Thu Sat', () => {
      assert.deepEqual([...pickTrainingDayIndexes(4)].sort(), [0, 1, 3, 5]);
    });
  });

  describe('activityMultiplierForTrainingDays', () => {
    it('increases multiplier with more training days', () => {
      const low = activityMultiplierForTrainingDays(2);
      const mid = activityMultiplierForTrainingDays(4);
      const high = activityMultiplierForTrainingDays(7);
      assert.ok(low < mid);
      assert.ok(mid < high);
      assert.equal(low, 1.375);
      assert.equal(mid, 1.55);
      assert.equal(high, 1.9);
    });
  });

  describe('describeTrainingWeek', () => {
    it('training + rest days sum to 7', () => {
      for (let n = MIN_TRAINING_DAYS; n <= MAX_TRAINING_DAYS; n += 1) {
        const w = describeTrainingWeek(n);
        assert.equal(w.trainingDays, n);
        assert.equal(w.restDays, 7 - n);
        assert.equal(w.training.length + w.rest.length, 7);
      }
    });

    it('labels are unique across training and rest', () => {
      const w = describeTrainingWeek(5);
      const all = [...w.training, ...w.rest];
      assert.equal(new Set(all).size, 7);
    });
  });
});
