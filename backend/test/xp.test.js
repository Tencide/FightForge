const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  STARTING_OVERALL,
  MAX_OVERALL,
  XP_PER_LEVEL,
  XP_REWARDS,
  computeOverall,
} = require('../lib/xp');

describe('xp.js', () => {
  describe('constants', () => {
    it('defines expected reward amounts', () => {
      assert.equal(XP_REWARDS.workoutComplete, 50);
      assert.equal(XP_REWARDS.mealComplete, 25);
    });

    it('uses 100 XP per overall level step from base 60', () => {
      assert.equal(XP_PER_LEVEL, 100);
      assert.equal(STARTING_OVERALL, 60);
      assert.equal(MAX_OVERALL, 99);
    });
  });

  describe('computeOverall', () => {
    it('starts at 60 with zero XP', () => {
      assert.equal(computeOverall(0), 60);
      assert.equal(computeOverall(-10), 60);
    });

    it('increases by 1 per 100 XP', () => {
      assert.equal(computeOverall(99), 60);
      assert.equal(computeOverall(100), 61);
      assert.equal(computeOverall(250), 62);
    });

    it('caps at 99 overall', () => {
      assert.equal(computeOverall(1_000_000), MAX_OVERALL);
      assert.equal(computeOverall(3900), 99);
      assert.equal(computeOverall(3899), 98);
    });

    it('treats non-finite XP as zero', () => {
      assert.equal(computeOverall(NaN), STARTING_OVERALL);
      assert.equal(computeOverall('bad'), STARTING_OVERALL);
    });
  });
});
