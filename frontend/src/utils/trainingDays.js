export const TRAINING_DAYS_MIN = 2;
export const TRAINING_DAYS_MAX = 7;
export const DEFAULT_TRAINING_DAYS = 4;

export const TRAINING_DAY_OPTIONS = [2, 3, 4, 5, 6, 7].map((n) => ({
  value: n,
  label: n === 1 ? '1 day' : `${n} days`,
}));

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TRAINING_PATTERNS = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function clampTrainingDays(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_TRAINING_DAYS;
  return Math.max(TRAINING_DAYS_MIN, Math.min(TRAINING_DAYS_MAX, Math.round(v)));
}

export function activityMultiplierForTrainingDays(days) {
  const d = clampTrainingDays(days);
  if (d <= 2) return 1.375;
  if (d <= 4) return 1.55;
  if (d <= 5) return 1.725;
  return 1.9;
}

/** Human-readable summary for profile settings. */
export function describeTrainingWeek(days) {
  const n = clampTrainingDays(days);
  const indexes = TRAINING_PATTERNS[n];
  const training = indexes.map((i) => DAY_LABELS[i]);
  const rest = DAY_LABELS.filter((_, i) => !indexes.includes(i));
  return {
    trainingDays: n,
    restDays: 7 - n,
    training,
    rest,
  };
}
