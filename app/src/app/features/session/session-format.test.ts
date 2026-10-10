import { describe, expect, it } from 'vitest';
import type { SessionSet } from '../../data/models/session';
import { formatSetGroup } from './session-format';

const set = (p: Partial<SessionSet>): SessionSet => ({
  id: 'x', position: 1, type: 'WORKING', side: 'BOTH', weightKg: null, reps: null, durationSeconds: null,
  distanceM: null, caloriesKcal: null, rpe: null, rir: null, romScore: null, restSecondsActual: null, completedAt: null, ...p,
});

describe('formatSetGroup', () => {
  it('força com e sem carga', () => {
    const ex = { kind: 'STRENGTH', metricType: 'WEIGHT_REPS' } as const;
    expect(formatSetGroup(ex, { position: 1, type: 'WORKING', sets: [set({ weightKg: 62.5, reps: 8 })] })).toBe('62,5 kg × 8');
    expect(formatSetGroup(ex, { position: 1, type: 'WORKING', sets: [set({ weightKg: 0, reps: 12 })] })).toBe('12 reps');
  });
  it('unilateral por duração com amplitude', () => {
    const ex = { kind: 'MOBILITY', metricType: 'DURATION' } as const;
    const group = {
      position: 1, type: 'WORKING' as const,
      sets: [set({ side: 'LEFT', durationSeconds: 45, romScore: 3 }), set({ side: 'RIGHT', durationSeconds: 40, romScore: 4 })],
    };
    expect(formatSetGroup(ex, group)).toBe('Esq 45 s · Dir 40 s · amplitude 3/4');
  });
  it('cardio com distância e calorias', () => {
    const ex = { kind: 'CARDIO', metricType: 'DURATION' } as const;
    expect(formatSetGroup(ex, { position: 1, type: 'WORKING', sets: [set({ durationSeconds: 1500, distanceM: 5000, caloriesKcal: 320 })] }))
      .toBe('25 min · 5 km · 320 kcal');
  });
});
