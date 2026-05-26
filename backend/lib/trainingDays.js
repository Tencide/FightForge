/** Mon=0 … Sun=6 — matches weekly plan layout in planGenerators. */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MIN_TRAINING_DAYS = 2;
const MAX_TRAINING_DAYS = 7;
const DEFAULT_TRAINING_DAYS = 4;

/** Which weekdays are training days for each days-per-week setting. */
const TRAINING_PATTERNS = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function clampTrainingDays(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_TRAINING_DAYS;
  return Math.max(MIN_TRAINING_DAYS, Math.min(MAX_TRAINING_DAYS, Math.round(v)));
}

function pickTrainingDayIndexes(count) {
  const n = clampTrainingDays(count);
  return new Set(TRAINING_PATTERNS[n]);
}

/** Activity multiplier from training frequency (Mifflin–St Jeor TDEE). */
function activityMultiplierForTrainingDays(days) {
  const d = clampTrainingDays(days);
  if (d <= 2) return 1.375;
  if (d <= 4) return 1.55;
  if (d <= 5) return 1.725;
  return 1.9;
}

function describeTrainingWeek(days) {
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

module.exports = {
  DAY_LABELS,
  MIN_TRAINING_DAYS,
  MAX_TRAINING_DAYS,
  DEFAULT_TRAINING_DAYS,
  clampTrainingDays,
  pickTrainingDayIndexes,
  activityMultiplierForTrainingDays,
  describeTrainingWeek,
};
