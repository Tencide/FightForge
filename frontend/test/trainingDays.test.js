import { describe, it, expect } from 'vitest';
import {
  TRAINING_DAYS_MIN,
  TRAINING_DAYS_MAX,
  DEFAULT_TRAINING_DAYS,
  TRAINING_DAY_OPTIONS,
  clampTrainingDays,
  activityMultiplierForTrainingDays,
  describeTrainingWeek,
} from '../src/utils/trainingDays.js';

describe('frontend trainingDays utils', () => {
  it('exports day options for 2–7 days', () => {
    expect(TRAINING_DAY_OPTIONS).toHaveLength(6);
    expect(TRAINING_DAY_OPTIONS[0].value).toBe(2);
    expect(TRAINING_DAY_OPTIONS[5].value).toBe(7);
  });

  it('clamps training days within bounds', () => {
    expect(clampTrainingDays(1)).toBe(TRAINING_DAYS_MIN);
    expect(clampTrainingDays(10)).toBe(TRAINING_DAYS_MAX);
    expect(clampTrainingDays(undefined)).toBe(DEFAULT_TRAINING_DAYS);
  });

  it('matches backend activity multipliers', () => {
    expect(activityMultiplierForTrainingDays(2)).toBe(1.375);
    expect(activityMultiplierForTrainingDays(4)).toBe(1.55);
    expect(activityMultiplierForTrainingDays(7)).toBe(1.9);
  });

  it('describeTrainingWeek balances training and rest', () => {
    const week = describeTrainingWeek(4);
    expect(week.trainingDays).toBe(4);
    expect(week.restDays).toBe(3);
    expect(week.training).toContain('Mon');
    expect(week.rest.length).toBe(3);
  });
});
