const assert = require('assert');
const { computeAnnualExerciseSplit } = require('../services/requsetServices');

const result = computeAnnualExerciseSplit(12, [
  { exercise_id: 1, year: 2025, balance: 8 },
  { exercise_id: 2, year: 2024, balance: 7 },
  { exercise_id: 3, year: 2023, balance: 6 }
], 2026);

assert.deepStrictEqual(result, [
  { exercise_id: 3, year: 2023, days_allocated: 6 },
  { exercise_id: 2, year: 2024, days_allocated: 6 }
]);

console.log('annual split test passed');
