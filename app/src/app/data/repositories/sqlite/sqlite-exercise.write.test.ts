import { beforeEach, describe, expect, it } from 'vitest';
import { LIBRARY } from '../../../core/library/library-data';
import { libraryItemToInput } from '../../../core/library/library';
import { SEED } from '../../seed/seed.generated';
import { loadSeed } from '../../seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { ids } from '../../../core/util/uuid';
import { ExerciseValidationError } from '../../models/exercise';
import { SqliteExerciseRepository } from './sqlite-exercise.repository';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
let db: Db;
let repo: SqliteExerciseRepository;
let clock: FixedClock;

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  await loadSeed(db, TEST_SEED, t.deviceId);
  clock = new FixedClock(new Date('2026-10-10T08:00:00.000Z'));
  repo = new SqliteExerciseRepository(db, clock, t.deviceId);
});

const libItem = (name: string) => {
  const item = LIBRARY.items.find((i) => i.name === name || i.namePt === name);
  if (!item) throw new Error(`item não existe: ${name}`);
  return item;
};

describe('save', () => {
  it('cria um exercício de força com músculos', async () => {
    const ex = await repo.save({
      name: '  Face pull  ', kind: 'STRENGTH', metricType: 'WEIGHT_REPS', region: 'UPPER', movementType: 'PULL',
      equipmentId: ids.equipment('cable'), primaryMuscleIds: [ids.muscle('shoulders')],
      secondaryMuscleIds: [ids.muscle('traps'), ids.muscle('shoulders')],
    });
    expect(ex).toMatchObject({
      name: 'Face pull', equipmentName: 'Cabo', primaryMuscleIds: [ids.muscle('shoulders')],
      secondaryMuscleIds: [ids.muscle('traps')], updatedAt: '2026-10-10T08:00:00.000Z',
    });
  });

  it('valida nome obrigatório, único (sem acentos nem maiúsculas) e medida da mobilidade', async () => {
    await expect(repo.save({ name: '  ', kind: 'STRENGTH', metricType: 'REPS' })).rejects.toThrow(ExerciseValidationError);
    await expect(repo.save({ name: 'squat', kind: 'STRENGTH', metricType: 'REPS' })).rejects.toThrow(/Já tens/);
    await expect(repo.save({ name: 'Gato-Camelo', kind: 'MOBILITY', metricType: 'REPS' })).rejects.toThrow(/Já tens/);
    await expect(repo.save({ name: 'Novo', kind: 'MOBILITY', metricType: 'WEIGHT_REPS' })).rejects.toThrow(/Mobilidade/);
  });

  it('arquivados não contam para a unicidade do nome', async () => {
    await repo.archive(ids.exercise('Squat'));
    await expect(repo.save({ name: 'Squat', kind: 'STRENGTH', metricType: 'WEIGHT_REPS' })).resolves.toBeTruthy();
    // e restaurar o antigo com o mesmo nome é recusado
    await expect(repo.restore(ids.exercise('Squat'))).rejects.toThrow(/Já tens/);
  });

  it('editar troca ligações sem duplicar e reutiliza as linhas', async () => {
    const id = ids.exercise('Squat');
    const base = (await repo.get(id))!;
    await repo.save({ ...base, primaryMuscleIds: [ids.muscle('glutes')], secondaryMuscleIds: [] });
    let ex = (await repo.get(id))!;
    expect(ex.primaryMuscleIds).toEqual([ids.muscle('glutes')]);
    expect(ex.secondaryMuscleIds).toEqual([]);
    await repo.save({ ...base });
    ex = (await repo.get(id))!;
    expect(ex.primaryMuscleIds).toEqual([ids.muscle('quadriceps')]);
    expect(ex.secondaryMuscleIds).toEqual([ids.muscle('glutes')]);
    const rows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM exercise_muscle WHERE exercise_id = ?', [id]);
    expect(rows[0].n).toBe(2);
  });

  it('mobilidade guarda áreas e ignora músculos e tipo push/pull', async () => {
    const ex = await repo.save({
      name: 'Rotação de anca', kind: 'MOBILITY', metricType: 'DURATION', isUnilateral: true, movementType: 'PUSH',
      primaryMuscleIds: [ids.muscle('glutes')], mobilityAreaIds: [ids.mobilityArea('hip')],
    });
    expect(ex).toMatchObject({ movementType: null, primaryMuscleIds: [], mobilityAreaIds: [ids.mobilityArea('hip')], isUnilateral: true });
  });
});

describe('cardio', () => {
  it('aceita só duração e ignora unilateral, isométrico e push/pull', async () => {
    await expect(repo.save({ name: 'Corrida', kind: 'CARDIO', metricType: 'REPS' })).rejects.toThrow(/Cardio/);
    const ex = await repo.save({
      name: 'Corrida', kind: 'CARDIO', metricType: 'DURATION', isUnilateral: true, isIsometric: true,
      movementType: 'PUSH', equipmentId: ids.equipment('treadmill'),
    });
    expect(ex).toMatchObject({ kind: 'CARDIO', isUnilateral: false, isIsometric: false, movementType: null, equipmentName: 'Passadeira' });
  });

  it('a biblioteca tem os 24 de cardio do catálogo (e os do free-exercise-db) e adicionam-se sem erros', async () => {
    const cardio = LIBRARY.items.filter((i) => i.kind === 'CARDIO');
    expect(cardio.filter((i) => i.source === 'catalog')).toHaveLength(24);
    for (const item of cardio) await repo.save(libraryItemToInput(item));
    expect(await repo.list({ kind: 'CARDIO' })).toHaveLength(cardio.length);
  });

  it('ordenação por mais recentes', async () => {
    clock.advance(60_000);
    await repo.save({ name: 'Recente', kind: 'CARDIO', metricType: 'DURATION' });
    expect((await repo.list({ sort: 'recent' }))[0].name).toBe('Recente');
  });
});

describe('arquivar, restaurar e remover', () => {
  it('arquivar esconde da lista e restaurar devolve', async () => {
    const id = ids.exercise('Lunges');
    clock.advance(60_000);
    await repo.archive(id);
    expect((await repo.list()).some((e) => e.id === id)).toBe(false);
    expect((await repo.get(id))?.archivedAt).toBe('2026-10-10T08:01:00.000Z');
    await repo.restore(id);
    expect((await repo.list()).some((e) => e.id === id)).toBe(true);
  });

  it('remover só se nunca foi usado', async () => {
    const free = await repo.save({ name: 'Temporário', kind: 'STRENGTH', metricType: 'REPS', primaryMuscleIds: [ids.muscle('abs')] });
    await repo.remove(free.id);
    expect(await repo.get(free.id)).toBeNull();
    const link = await db.query<{ deleted_at: string | null }>('SELECT deleted_at FROM exercise_muscle WHERE exercise_id = ?', [free.id]);
    expect(link[0].deleted_at).not.toBeNull();

    const used = ids.exercise('Squat');
    await db.run("INSERT INTO workout_template (id, name, updated_at, device_id) VALUES ('t', 'A', '2026-10-10T00:00:00Z', 'd')");
    await db.run(`INSERT INTO planned_exercise (id, template_id, exercise_id, position, updated_at, device_id)
                  VALUES ('p', 't', ?, 1, '2026-10-10T00:00:00Z', 'd')`, [used]);
    expect(await repo.isUsed(used)).toBe(true);
    await expect(repo.remove(used)).rejects.toThrow(/Arquiva/);
  });
});

describe('biblioteca', () => {
  it('tem centenas de exercícios, nomes e chaves únicos, e só usa músculos e equipamentos do seed', () => {
    expect(LIBRARY.items.length).toBeGreaterThan(300);
    const muscleKeys = new Set(SEED.muscles.map((m) => m.key));
    const equipmentKeys = new Set(SEED.equipment.map((e) => e.key));
    const names = new Set<string>();
    const keys = new Set<string>();
    for (const i of LIBRARY.items) {
      expect(names.has(i.name.toLowerCase()), i.name).toBe(false);
      expect(keys.has(i.key), i.key).toBe(false);
      names.add(i.name.toLowerCase());
      keys.add(i.key);
      if (i.equipment) expect(equipmentKeys.has(i.equipment), i.name).toBe(true);
      for (const m of [...i.primary, ...i.secondary]) expect(muscleKeys.has(m), `${i.name}: ${m}`).toBe(true);
    }
  });

  it('adicionar cria o exercício com id determinístico, músculos e variações nas notas', async () => {
    const item = libItem('Puxada à frente');
    const ex = await repo.save(libraryItemToInput(item));
    expect(ex.id).toBe(ids.libraryExercise(item.key));
    expect(ex).toMatchObject({
      name: 'Lat Pulldown', equipmentName: 'Cabo', metricType: 'WEIGHT_REPS',
      primaryMuscleIds: [ids.muscle('lats')], secondaryMuscleIds: [ids.muscle('biceps'), ids.muscle('upper_back'), ids.muscle('rear_delt')],
      notes: 'Variações: pega larga, fechada, neutra, supinada',
    });
  });

  it('mobilidade da biblioteca traz áreas e sem equipamento', async () => {
    // base nova com o seed de produção (sem os exercícios antigos)
    const t = await createTestDb();
    await loadSeed(t.db, SEED, t.deviceId);
    const fresh = new SqliteExerciseRepository(t.db, clock, t.deviceId);
    const ex = await fresh.save(libraryItemToInput(libItem('90/90 de anca')));
    expect(ex).toMatchObject({ kind: 'MOBILITY', metricType: 'DURATION', isUnilateral: true, equipmentId: null,
      mobilityAreaIds: [ids.mobilityArea('hip')] });
    expect(LIBRARY.items.filter((i) => i.kind === 'MOBILITY' && i.source === 'catalog')).toHaveLength(33);
  });

  it('peso corporal mede-se por reps, pranchas por duração, búlgaro é unilateral', async () => {
    expect(libItem('Flexões')).toMatchObject({ metricType: 'REPS', isUnilateral: false });
    expect(libItem('Prancha')).toMatchObject({ metricType: 'DURATION', isIsometric: true });
    expect(libItem('Agachamento búlgaro')).toMatchObject({ isUnilateral: true, primary: ['quadriceps', 'glutes'] });
  });

  it('adicionar outra vez depois de arquivar reativa a mesma linha', async () => {
    const input = libraryItemToInput(libItem('Prancha'));
    await repo.save(input);
    await repo.archive(input.id!);
    await repo.save(input);
    const rows = await db.query<{ n: number }>("SELECT COUNT(*) AS n FROM exercise WHERE name = 'Plank'");
    expect(rows[0].n).toBe(1);
    expect((await repo.get(input.id!))?.archivedAt).toBeNull();
  });

  it('os novos grupos musculares chegam a bases que já tinham o seed v1', async () => {
    const t = await createTestDb();
    await loadSeed(t.db, { ...TEST_SEED, version: 1, muscles: SEED.muscles.filter((m) => m.key !== 'traps') }, t.deviceId);
    await loadSeed(t.db, SEED, t.deviceId);
    const traps = await t.db.query('SELECT 1 FROM muscle_group WHERE id = ?', [ids.muscle('traps')]);
    expect(traps).toHaveLength(1);
  });
});
