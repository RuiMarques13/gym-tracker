import { describe, expect, it } from 'vitest';
import { formatTargets } from './workout-format';

describe('formatTargets', () => {
  it('força com carga e descanso', () => {
    expect(formatTargets('STRENGTH', 'WEIGHT_REPS', false, { targetSets: 4, targetReps: 8, targetWeightKg: 62.5, restSeconds: 120 }))
      .toBe('4 × 8 · 62,5 kg · descanso 2 min');
  });
  it('mobilidade por duração e por lado', () => {
    expect(formatTargets('MOBILITY', 'DURATION', true, { targetSets: 2, targetDurationSeconds: 45 })).toBe('2 × 45 s por lado');
  });
  it('cardio com distância', () => {
    expect(formatTargets('CARDIO', 'DURATION', false, { targetSets: 1, targetDurationSeconds: 1500, targetDistanceM: 5000 }))
      .toBe('25 min · 5 km');
    expect(formatTargets('CARDIO', 'DURATION', false, { targetSets: 4, targetDurationSeconds: 90 })).toBe('4 × 1 min 30 s');
  });
});
