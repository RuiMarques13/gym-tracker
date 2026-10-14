import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../../core/seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../../core/testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { ids } from '../../../core/util/uuid';
import { SqliteSessionRepository } from './sqlite-session.repository';
import { SqliteWorkoutRepository } from './sqlite-workout.repository';

let repo: SqliteSessionRepository;
let workouts: SqliteWorkoutRepository;
let clock: FixedClock;
const squat = ids.exercise('Squat');

beforeEach(async () => {
  const t = await createTestDb();
  await loadSeed(t.db, TEST_SEED, t.deviceId);
  clock = new FixedClock(new Date('2026-10-10T08:00:00.000Z'));
  repo = new SqliteSessionRepository(t.db, clock, t.deviceId);
  workouts = new SqliteWorkoutRepository(t.db, clock, t.deviceId);
});

describe('faixa de repetições e histórico para a sugestão de carga', () => {
  it('o treino guarda a faixa (troca se vier ao contrário) e a sessão copia-a', async () => {
    const w = await workouts.save({ name: 'Pernas', items: [{ exerciseId: squat, block: 'MAIN', targetSets: 3, targetRepsMin: 12, targetReps: 8 }] });
    expect(w.items[0]).toMatchObject({ targetRepsMin: 8, targetReps: 12 });
    const s = await repo.start({ templateId: w.id });
    expect(s.exercises[0]).toMatchObject({ targetRepsMin: 8, targetReps: 12 });
  });

  it('recentSets devolve as últimas sessões terminadas, da mais recente para a mais antiga', async () => {
    const w = await workouts.save({ name: 'Pernas', items: [{ exerciseId: squat, block: 'MAIN', targetSets: 1, targetReps: 12 }] });
    for (const kg of [60, 62.5]) {
      const s = await repo.start({ templateId: w.id });
      await repo.saveSet({ sessionExerciseId: s.exercises[0].id, type: 'WORKING', entries: [{ side: 'BOTH', weightKg: kg, reps: 12 }] });
      clock.advance(3_600_000);
      await repo.finish(s.id);
      clock.advance(86_400_000);
    }
    const now = await repo.start({ templateId: w.id });
    const recent = await repo.recentSets(squat, now.id, 3);
    expect(recent.map((sets) => sets[0].weightKg)).toEqual([62.5, 60]);
  });
});
