import { describe, expect, it } from 'vitest';
import type { Session, SessionExercise, SessionSet } from '../../data/models/session';
import { paceOf, sessionStats } from './session-stats';

const set = (p: number, o: Partial<SessionSet> = {}): SessionSet => ({
  id: `s${p}`, position: p, type: 'WORKING', side: 'BOTH', weightKg: null, reps: null, durationSeconds: null, distanceM: null,
  caloriesKcal: null, rpe: null, rir: null, romScore: null, restSecondsActual: null, completedAt: null, ...o,
});
const ex = (o: Partial<SessionExercise>): SessionExercise => ({
  id: 'e', exerciseId: 'x', exerciseName: 'Supino', kind: 'STRENGTH', metricType: 'WEIGHT_REPS', isUnilateral: false, block: 'MAIN',
  position: 1, supersetGroup: null, targetSets: null, targetReps: null, targetDurationSeconds: null, targetWeightKg: null,
  targetDistanceM: null, restSeconds: null, notes: null, sets: [], ...o,
});
const session = (exercises: SessionExercise[], minutes = 60): Session => ({
  id: 's', templateId: null, templateName: null, scheduledId: null, startedAt: '2026-01-01T10:00:00.000Z',
  endedAt: new Date(Date.UTC(2026, 0, 1, 10, minutes)).toISOString(), pausedSeconds: 0, rpe: null, notes: null, lastActivityAt: null, exercises,
});
const body = { weightKg: 80, heightCm: 180, age: 30, sex: 'M' as const };

describe('sessionStats', () => {
  it('separa tempo ativo e descanso e soma o volume', () => {
    const s = session([ex({ sets: [set(1, { weightKg: 60, reps: 10 }), set(2, { weightKg: 60, reps: 10 })] })]);
    const st = sessionStats(s, 0, body);
    expect(st.totalSeconds).toBe(3600);
    expect(st.activeSeconds).toBe(70); // 20 reps × 3,5 s
    expect(st.restSeconds).toBe(3530);
    expect(st.volumeKg).toBe(1200);
    expect(st.sets).toBe(2);
  });

  it('no cardio usa a duração e a distância', () => {
    const s = session([ex({ exerciseName: 'Caminhada', kind: 'CARDIO', metricType: 'DURATION', sets: [set(1, { durationSeconds: 1200, distanceM: 1300, caloriesKcal: 120 })] })], 21);
    const st = sessionStats(s, 0, body);
    expect(st.activeSeconds).toBe(1200);
    expect(st.distanceM).toBe(1300);
    expect(st.loggedKcal).toBe(120);
    expect(st.estimatedKcal).toBeGreaterThan(0);
    expect(paceOf(1300, 1200)?.kmh).toBeCloseTo(3.9, 1);
  });

  it('sem peso não estima; sessão em curso usa o relógio', () => {
    const running = { ...session([]), endedAt: null };
    const st = sessionStats(running, Date.parse('2026-01-01T10:30:00.000Z'), { ...body, weightKg: null });
    expect(st.totalSeconds).toBe(1800);
    expect(st.estimatedKcal).toBeNull();
  });
});
