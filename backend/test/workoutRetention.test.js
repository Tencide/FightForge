const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('workoutRetention.js', () => {
  const envKey = 'WORKOUT_RETENTION_DAYS';
  let previous;

  beforeEach(() => {
    previous = process.env[envKey];
    delete require.cache[require.resolve('../lib/workoutRetention')];
  });

  afterEach(() => {
    if (previous === undefined) delete process.env[envKey];
    else process.env[envKey] = previous;
    delete require.cache[require.resolve('../lib/workoutRetention')];
  });

  it('defaults to 7 days when env unset', () => {
    delete process.env[envKey];
    const { retentionDays } = require('../lib/workoutRetention');
    assert.equal(retentionDays(), 7);
  });

  it('reads valid env integer', () => {
    process.env[envKey] = '14';
    const { retentionDays } = require('../lib/workoutRetention');
    assert.equal(retentionDays(), 14);
  });

  it('falls back for invalid or sub-1 values', () => {
    process.env[envKey] = '0';
    let { retentionDays } = require('../lib/workoutRetention');
    assert.equal(retentionDays(), 7);

    delete require.cache[require.resolve('../lib/workoutRetention')];
    process.env[envKey] = 'abc';
    ({ retentionDays } = require('../lib/workoutRetention'));
    assert.equal(retentionDays(), 7);
  });

  it('caps retention at 365 days', () => {
    process.env[envKey] = '999';
    const { retentionDays } = require('../lib/workoutRetention');
    assert.equal(retentionDays(), 365);
  });
});
