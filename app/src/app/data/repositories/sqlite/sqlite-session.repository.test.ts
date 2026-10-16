import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../testing/test-db';
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
    await expect(repo.finish(s.id)).rejects.toThrow(/terminou/);
    // pode começar outra
    await expect(repo.start()).resolves.toBeTruthy();
  });

  it('corrige sessões terminadas: séries, exercícios, esforço e notas; séries novas contam no fim da sessão', async () => {
    const s = await repo.start();
    const ex = await repo.addExercise(s.id, squat);
    await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    clock.advance(40 * 60_000);
    await repo.finish(s.id);
    clock.advance(86400_000);
    let r = await repo.saveSet({ sessionExerciseId: ex.id, position: 1, entries: [{ side: 'BOTH', weightKg: 62.5, reps: 8 }] });
    expect(r.sets[0].weightKg).toBe(62.5);
    r = await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 62.5, reps: 6 }] });
    expect(r.sets[1]).toMatchObject({ position: 2, completedAt: '2026-10-10T08:40:00.000Z', restSecondsActual: null });
    const d = await repo.updateDetails(s.id, { rpe: 7, notes: ' corrigido ' });
    expect(d).toMatchObject({ rpe: 7, notes: 'corrigido', endedAt: '2026-10-10T08:40:00.000Z' });
    const extra = await repo.addExercise(s.id, catCow);
    expect(extra.position).toBe(2);
    await repo.removeExercise(extra.id);
  });

  it('lista as sessões terminadas com totais e dá o histórico por exercício', async () => {
    const s1 = await repo.start();
    const a = await repo.addExercise(s1.id, squat);
    await repo.saveSet({ sessionExerciseId: a.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    await repo.saveSet({ sessionExerciseId: a.id, type: 'WARMUP', entries: [{ side: 'BOTH', weightKg: 20, reps: 10 }] });
    const b = await repo.addExercise(s1.id, pigeon);
    await repo.saveSet({
      sessionExerciseId: b.id,
      entries: [{ side: 'LEFT', durationSeconds: 30 }, { side: 'RIGHT', durationSeconds: 30 }],
    });
    clock.advance(30 * 60_000);
    await repo.finish(s1.id, { rpe: 8 });
    clock.advance(86400_000);
    const s2 = await repo.start();
    const c = await repo.addExercise(s2.id, squat);
    await repo.saveSet({ sessionExerciseId: c.id, entries: [{ side: 'BOTH', weightKg: 65, reps: 5 }] });
    expect(await repo.listFinished()).toHaveLength(1); // a s2 ainda está em curso
    clock.advance(20 * 60_000);
    await repo.finish(s2.id);
    const list = await repo.listFinished();
    expect(list.map((x) => x.id)).toEqual([s2.id, s1.id]);
    expect(list[1]).toMatchObject({ exerciseCount: 2, setCount: 3, volumeKg: 480, rpe: 8 });
    const hist = await repo.exerciseHistory(squat);
    expect(hist.map((h) => [h.sessionId, h.sets.length])).toEqual([[s2.id, 1], [s1.id, 2]]);
    expect(await repo.exerciseHistory(catCow)).toEqual([]);
  });

  it('propõe o fim de uma sessão esquecida na última série e termina nesse instante', async () => {
    const s = await repo.start();
    const ex = await repo.addExercise(s.id, squat);
    clock.advance(10 * 60_000);
    await repo.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
    const last = (await repo.get(s.id))!.lastActivityAt!;
    expect(last).toBe('2026-10-10T08:10:00.000Z');
    clock.advance(9 * 3600_000);
    const done = await repo.finish(s.id, { endedAt: last });
    expect(done.endedAt).toBe(last);
    // um fim anterior ao início é ignorado
    const s2 = await repo.start();
    const d2 = await repo.finish(s2.id, { endedAt: '2000-01-01T00:00:00.000Z' });
    expect(d2.endedAt).toBe('2026-10-10T17:10:00.000Z'); // o relógio atual
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
