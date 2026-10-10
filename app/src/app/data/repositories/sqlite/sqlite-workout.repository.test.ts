import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../../core/seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../../core/testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { ids } from '../../../core/util/uuid';
import { WorkoutValidationError } from '../../models/workout';
import { SqliteExerciseRepository } from './sqlite-exercise.repository';
import { SqliteWorkoutRepository } from './sqlite-workout.repository';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
let db: Db;
let repo: SqliteWorkoutRepository;
let exercises: SqliteExerciseRepository;
let clock: FixedClock;

const squat = ids.exercise('Squat');
const rdl = ids.exercise('RDL');
const catCow = ids.exercise('Gato-camelo'); // mobilidade, reps
const pigeon = ids.exercise('Pombo (pigeon)'); // mobilidade, duração

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  await loadSeed(db, TEST_SEED, t.deviceId);
  clock = new FixedClock(new Date('2026-10-10T08:00:00.000Z'));
  repo = new SqliteWorkoutRepository(db, clock, t.deviceId);
  exercises = new SqliteExerciseRepository(db, clock, t.deviceId);
});

const legDay = () =>
  repo.save({
    name: 'Pernas A',
    notes: 'Foco em técnica',
    items: [
      { exerciseId: squat, block: 'MAIN', targetSets: 4, targetReps: 8, targetWeightKg: 60, restSeconds: 120 },
      { exerciseId: catCow, block: 'WARMUP', targetSets: 2, targetReps: 10 },
      { exerciseId: rdl, block: 'MAIN', targetSets: 3, targetReps: 10 },
      { exerciseId: pigeon, block: 'MAIN', targetSets: 2, targetDurationSeconds: 45 },
    ],
  });

describe('SqliteWorkoutRepository', () => {
  it('guarda e ordena por bloco (aquecimento, principal; mobilidade pode estar em qualquer um) mantendo a ordem dentro de cada bloco', async () => {
    const w = await legDay();
    expect(w.items.map((i) => [i.block, i.exerciseName, i.position])).toEqual([
      ['WARMUP', 'Gato-camelo', 1],
      ['MAIN', 'Squat', 2],
      ['MAIN', 'RDL', 3],
      ['MAIN', 'Pombo (pigeon)', 4],
    ]);
    expect(w.items[1]).toMatchObject({ targetSets: 4, targetReps: 8, targetWeightKg: 60, restSeconds: 120 });
    expect(w.notes).toBe('Foco em técnica');
  });

  it("linhas antigas com bloco 'MOBILITY' são lidas como principal", async () => {
    const w = await legDay();
    await db.run(`UPDATE planned_exercise SET block = 'MOBILITY' WHERE template_id = ? AND exercise_id = ?`, [w.id, pigeon]);
    const again = (await repo.get(w.id))!;
    expect(again.items.find((i) => i.exerciseId === pigeon)?.block).toBe('MAIN');
    expect((await repo.list())[0].blockCounts).toEqual({ WARMUP: 1, MAIN: 3 });
  });

  it('normaliza os alvos conforme a medida do exercício', async () => {
    const w = await repo.save({
      name: 'X',
      items: [
        // mobilidade por duração: reps e carga são descartadas
        { exerciseId: pigeon, block: 'MAIN', targetSets: 0, targetReps: 10, targetWeightKg: 5, targetDurationSeconds: 30.4 },
        // mobilidade por reps: sem carga nem duração
        { exerciseId: catCow, block: 'WARMUP', targetReps: 10, targetWeightKg: 5, targetDurationSeconds: 30 },
      ],
    });
    expect(w.items.find((i) => i.exerciseId === pigeon)).toMatchObject({
      targetSets: 1, targetReps: null, targetWeightKg: null, targetDurationSeconds: 30,
    });
    expect(w.items.find((i) => i.exerciseId === catCow)).toMatchObject({
      targetReps: 10, targetWeightKg: null, targetDurationSeconds: null,
    });
  });

  it('cardio guarda duração e distância', async () => {
    const run = await exercises.save({ name: 'Corrida', kind: 'CARDIO', metricType: 'DURATION' });
    const w = await repo.save({
      name: 'Cardio', items: [{ exerciseId: run.id, block: 'MAIN', targetDurationSeconds: 1800, targetDistanceM: 5000, targetReps: 3 }],
    });
    expect(w.items[0]).toMatchObject({ targetSets: 1, targetDurationSeconds: 1800, targetDistanceM: 5000, targetReps: null });
  });

  it('editar acrescenta, altera, reordena e remove itens sem duplicar', async () => {
    const w = await legDay();
    const [warm, sq, rd, mob] = w.items;
    clock.advance(60_000);
    const edited = await repo.save({
      id: w.id,
      name: 'Pernas A',
      items: [
        { ...rd, targetSets: 5 },
        { ...sq },
        { exerciseId: ids.exercise('Hip Thrust'), block: 'MAIN', targetSets: 3, targetReps: 12 },
        { ...mob, block: 'WARMUP' },
      ],
    });
    expect(edited.items.map((i) => [i.block, i.exerciseName])).toEqual([
      ['WARMUP', 'Pombo (pigeon)'],
      ['MAIN', 'RDL'],
      ['MAIN', 'Squat'],
      ['MAIN', 'Hip Thrust'],
    ]);
    expect(edited.items.find((i) => i.id === rd.id)?.targetSets).toBe(5);
    expect(edited.items.find((i) => i.id === mob.id)?.block).toBe('WARMUP');
    const removed = await db.query<{ deleted_at: string | null }>('SELECT deleted_at FROM planned_exercise WHERE id = ?', [warm.id]);
    expect(removed[0].deleted_at).toBe('2026-10-10T08:01:00.000Z');
    const total = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM planned_exercise');
    expect(total[0].n).toBe(5);
  });

  it('valida nome obrigatório e único, e exercícios que existem', async () => {
    await legDay();
    await expect(repo.save({ name: ' ', items: [] })).rejects.toThrow(WorkoutValidationError);
    await expect(repo.save({ name: 'pernas a', items: [] })).rejects.toThrow(/Já tens/);
    await expect(repo.save({ name: 'Y', items: [{ exerciseId: 'nao-existe', block: 'MAIN' }] })).rejects.toThrow(/já não existe/);
  });

  it('lista com contagem por bloco, sem arquivados por defeito', async () => {
    const w = await legDay();
    await repo.save({ name: 'Vazio', items: [] });
    let list = await repo.list();
    expect(list.map((l) => [l.name, l.exerciseCount])).toEqual([['Pernas A', 4], ['Vazio', 0]]);
    expect(list[0].blockCounts).toEqual({ WARMUP: 1, MAIN: 3 });
    await repo.archive(w.id);
    list = await repo.list();
    expect(list.map((l) => l.name)).toEqual(['Vazio']);
    expect((await repo.list({ includeArchived: true })).length).toBe(2);
  });

  it('copiar faz cópia profunda com nome novo e IDs novos', async () => {
    const w = await legDay();
    const c1 = await repo.copy(w.id);
    const c2 = await repo.copy(w.id);
    expect([c1.name, c2.name]).toEqual(['Pernas A (cópia)', 'Pernas A (cópia 2)']);
    expect(c1.items.map((i) => i.exerciseName)).toEqual(w.items.map((i) => i.exerciseName));
    expect(c1.items.map((i) => i.targetSets)).toEqual(w.items.map((i) => i.targetSets));
    expect(c1.items.some((i) => w.items.some((o) => o.id === i.id))).toBe(false);
    // editar a cópia não mexe no original
    await repo.save({ id: c1.id, name: c1.name, items: [] });
    expect((await repo.get(w.id))?.items).toHaveLength(4);
  });

  it('apagar só sem sessões; com sessões obriga a arquivar', async () => {
    const w = await legDay();
    await db.run(`INSERT INTO scheduled_workout (id, date, template_id, updated_at, device_id)
                  VALUES ('s', '2026-10-12', ?, '2026-10-10T00:00:00Z', 'd')`, [w.id]);
    const other = await repo.copy(w.id);
    await repo.remove(other.id);
    expect(await repo.get(other.id)).toBeNull();

    await db.run(`INSERT INTO session (id, template_id, started_at, updated_at, device_id)
                  VALUES ('x', ?, '2026-10-10T09:00:00Z', '2026-10-10T09:00:00Z', 'd')`, [w.id]);
    expect(await repo.isUsed(w.id)).toBe(true);
    await expect(repo.remove(w.id)).rejects.toThrow(/Arquiva/);
  });

  it('remover sem sessões apaga também itens e planeados', async () => {
    const w = await legDay();
    await db.run(`INSERT INTO scheduled_workout (id, date, template_id, updated_at, device_id)
                  VALUES ('s', '2026-10-12', ?, '2026-10-10T00:00:00Z', 'd')`, [w.id]);
    await repo.remove(w.id);
    const left = await db.query<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM planned_exercise WHERE deleted_at IS NULL)
            + (SELECT COUNT(*) FROM scheduled_workout WHERE deleted_at IS NULL) AS n`,
    );
    expect(left[0].n).toBe(0);
  });

  it('exercício arquivado continua no treino, marcado', async () => {
    const w = await legDay();
    await exercises.archive(rdl);
    const again = await repo.get(w.id);
    expect(again?.items.find((i) => i.exerciseId === rdl)?.exerciseArchived).toBe(true);
  });

  it('restaurar recusa se já houver outro treino ativo com o mesmo nome', async () => {
    const w = await legDay();
    await repo.archive(w.id);
    await repo.save({ name: 'Pernas A', items: [] });
    await expect(repo.restore(w.id)).rejects.toThrow(/Já tens/);
  });
});
