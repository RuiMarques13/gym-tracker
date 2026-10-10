import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../../core/seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../../core/testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { ids } from '../../../core/util/uuid';
import { groupSets, SessionError } from '../../models/session';
import { SqliteSessionRepository } from './sqlite-session.repository';
import { SqliteWorkoutRepository } from './sqlite-workout.repository';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let repo: SqliteSessionRepository;
let workouts: SqliteWorkoutRepository;
let clock: FixedClock;

const squat = ids.exercise('Squat'); // força, carga × reps
const catCow = ids.exercise('Gato-camelo'); // mobilidade, reps
const pigeon = ids.exercise('Pombo (pigeon)'); // mobilidade, duração (unilateral)

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  await loadSeed(db, TEST_SEED, t.deviceId);
  clock = new FixedClock(new Date('2026-10-10T08:00:00.000Z'));
  repo = new SqliteSessionRepository(db, clock, t.deviceId);
  workouts = new SqliteWorkoutRepository(db, clock, t.deviceId);
});

const template = () =>
  workouts.save({
    name: 'Pernas',
    items: [
      { exerciseId: catCow, block: 'WARMUP', targetSets: 2, targetReps: 10 },
      { exerciseId: squat, block: 'MAIN', targetSets: 4, targetReps: 8, targetWeightKg: 60, restSeconds: 120 },
    ],
  });

describe('SqliteSessionRepository', () => {
  it('começa a partir de um treino com snapshot dos alvos, e só deixa uma sessão ativa', async () => {
    const t = await template();
    const s = await repo.start({ templateId: t.id });
    expect(s.templateName).toBe('Pernas');
    expect(s.exercises.map((e) => [e.exerciseName, e.block, e.targetSets, e.restSeconds])).toEqual([
      ['Gato-camelo', 'WARMUP', 2, null],
      ['Squat', 'MAIN', 4, 120],
    ]);
    expect((await repo.getActive())?.id).toBe(s.id);
    await expect(repo.start()).rejects.toThrow(SessionError);

    // editar o treino depois não altera a sessão
    await workouts.save({ id: t.id, name: 'Pernas', items: [{ exerciseId: squat, block: 'MAIN', targetSets: 9, targetReps: 1 }] });
    expect((await repo.get(s.id))!.exercises.find((e) => e.exerciseId === squat)!.targetSets).toBe(4);
  });

  it('sessão livre: acrescenta e tira exercícios', async () => {
    const s = await repo.start();
    expect(s.exercises).toEqual([]);
    const a = await repo.addExercise(s.id, squat);
    const b = await repo.addExercise(s.id, pigeon, 'WARMUP');
    expect([a.position, b.position, b.block, b.isUnilateral]).toEqual([1, 2, 'WARMUP', true]);
    await repo.removeExercise(a.id);
    expect((await repo.get(s.id))!.exercises.map((e) => e.exerciseName)).toEqual(['Pombo (pigeon)']);
  });

  it('regista, edita e apaga séries de força', async () => {
    const s = await repo.start();
    const ex = await repo.addExercise(s.id, squat);
    let r = await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    r = await repo.saveSet({ sessionExerciseId: ex.id, type: 'WARMUP', entries: [{ side: 'BOTH', weightKg: 40, reps: 10 }] });
    r = await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 62.5, reps: 7 }] });
    expect(r.sets.map((x) => [x.position, x.type, x.weightKg, x.reps])).toEqual([
      [1, 'WORKING', 60, 8], [2, 'WARMUP', 40, 10], [3, 'WORKING', 62.5, 7],
    ]);
    r = await repo.saveSet({ sessionExerciseId: ex.id, position: 3, entries: [{ side: 'BOTH', weightKg: 65, reps: 6 }] });
    expect(r.sets.find((x) => x.position === 3)).toMatchObject({ weightKg: 65, reps: 6, type: 'WORKING' });
    r = await repo.deleteSet(ex.id, 2);
    expect(r.sets.map((x) => x.position)).toEqual([1, 3]);
    // a próxima série ocupa o fim, sem reaproveitar posições
    r = await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 65, reps: 5 }] });
    expect(r.sets.map((x) => x.position)).toEqual([1, 3, 4]);
  });

  it('unilaterais: LEFT e RIGHT partilham a position e editar/apagar atua nas duas', async () => {
    const s = await repo.start();
    const ex = await repo.addExercise(s.id, pigeon);
    let r = await repo.saveSet({
      sessionExerciseId: ex.id,
      entries: [
        { side: 'LEFT', durationSeconds: 45, romScore: 3 },
        { side: 'RIGHT', durationSeconds: 40, romScore: 4 },
      ],
    });
    expect(r.sets.map((x) => [x.position, x.side, x.durationSeconds, x.romScore])).toEqual([
      [1, 'LEFT', 45, 3], [1, 'RIGHT', 40, 4],
    ]);
    expect(groupSets(r.sets)).toHaveLength(1);
    r = await repo.saveSet({
      sessionExerciseId: ex.id, position: 1,
      entries: [{ side: 'LEFT', durationSeconds: 50 }, { side: 'RIGHT', durationSeconds: 50 }],
    });
    expect(r.sets.map((x) => x.durationSeconds)).toEqual([50, 50]);
    // editar para um só lado apaga o outro
    r = await repo.saveSet({ sessionExerciseId: ex.id, position: 1, entries: [{ side: 'LEFT', durationSeconds: 30 }] });
    expect(r.sets.map((x) => x.side)).toEqual(['LEFT']);
    r = await repo.deleteSet(ex.id, 1);
    expect(r.sets).toEqual([]);
    await expect(
      repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', durationSeconds: 30 }] }),
    ).rejects.toThrow(/Lado inválido/);
  });

  it('valida por tipo de medida e descarta campos que não se aplicam', async () => {
    const s = await repo.start();
    const sq = await repo.addExercise(s.id, squat);
    const cc = await repo.addExercise(s.id, catCow);
    await expect(repo.saveSet({ sessionExerciseId: sq.id, entries: [{ side: 'BOTH', weightKg: 50 }] })).rejects.toThrow(/repetições/);
    const r = await repo.saveSet({
      sessionExerciseId: cc.id,
      entries: [{ side: 'BOTH', reps: 12, weightKg: 20, durationSeconds: 30, distanceM: 100, romScore: 9 }],
    });
    expect(r.sets[0]).toMatchObject({ reps: 12, weightKg: null, durationSeconds: null, distanceM: null, romScore: 5 });
  });

  it('guarda o descanso real entre séries consecutivas', async () => {
    const s = await repo.start();
    const ex = await repo.addExercise(s.id, squat);
    await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    clock.advance(95_000);
    await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    clock.advance(3 * 3600_000); // pausa enorme: não conta como descanso
    const r = await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    expect(r.sets.map((x) => x.restSecondsActual)).toEqual([95, null, null]);
  });

  it('termina a sessão e a seguir já não aceita alterações', async () => {
    const s = await repo.start();
    const ex = await repo.addExercise(s.id, squat);
    await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    clock.advance(40 * 60_000);
    const done = await repo.finish(s.id, { rpe: 8.5, notes: ' boa sessão ' });
    expect(done).toMatchObject({ rpe: 8.5, notes: 'boa sessão', endedAt: '2026-10-10T08:40:00.000Z' });
    expect(await repo.getActive()).toBeNull();
    await expect(repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 1, reps: 1 }] })).rejects.toThrow(/terminou/);
    await expect(repo.finish(s.id)).rejects.toThrow(/terminou/);
    // pode começar outra
    await expect(repo.start()).resolves.toBeTruthy();
  });

  it('descartar apaga a sessão, os exercícios e as séries', async () => {
    const s = await repo.start();
    const ex = await repo.addExercise(s.id, squat);
    await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    await repo.discard(s.id);
    expect(await repo.get(s.id)).toBeNull();
    expect(await repo.getActive()).toBeNull();
    const left = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM set_log WHERE deleted_at IS NULL');
    expect(left[0].n).toBe(0);
  });

  it('sessões anteriores servem para pré-preencher (ignora a própria e as não terminadas)', async () => {
    const s1 = await repo.start();
    const e1 = await repo.addExercise(s1.id, squat);
    await repo.saveSet({ sessionExerciseId: e1.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    expect(await repo.previousSets(squat)).toEqual([]);
    clock.advance(3600_000);
    await repo.finish(s1.id);
    clock.advance(86400_000);
    const s2 = await repo.start();
    const e2 = await repo.addExercise(s2.id, squat);
    await repo.saveSet({ sessionExerciseId: e2.id, entries: [{ side: 'BOTH', weightKg: 70, reps: 5 }] });
    expect((await repo.previousSets(squat, s2.id)).map((x) => [x.weightKg, x.reps])).toEqual([[60, 8]]);
    expect(await repo.previousSets(catCow)).toEqual([]);
  });

  it('um treino com sessões já não se apaga (continua a regra da fase 1.2)', async () => {
    const t = await template();
    await repo.start({ templateId: t.id });
    expect(await workouts.isUsed(t.id)).toBe(true);
    await expect(workouts.remove(t.id)).rejects.toThrow(/sessões/);
  });
});
