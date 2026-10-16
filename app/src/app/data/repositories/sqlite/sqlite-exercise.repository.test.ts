import { beforeAll, describe, expect, it } from 'vitest';
import { SEED } from '../../seed/seed.generated';
import { loadSeed } from '../../seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { ids } from '../../../core/util/uuid';
import { SqliteExerciseRepository } from './sqlite-exercise.repository';

let repo: SqliteExerciseRepository;

beforeAll(async () => {
  const { db, deviceId } = await createTestDb();
  await loadSeed(db, TEST_SEED, deviceId);
  await db.run("UPDATE exercise SET archived_at = '2026-10-10T00:00:00.000Z' WHERE name = 'C Pullover'");
  repo = new SqliteExerciseRepository(db, new FixedClock(new Date('2026-10-10T08:00:00.000Z')), deviceId);
});

const names = async (filter: Parameters<SqliteExerciseRepository['list']>[0]) =>
  (await repo.list(filter)).map((e) => e.name);

describe('SqliteExerciseRepository.list', () => {
  it('lista tudo menos arquivados, por ordem alfabética', async () => {
    const all = await names({});
    expect(all).toHaveLength(38);
    expect(all).not.toContain('C Pullover');
    expect(all[0]).toBe('1 Leg Hip Thrust');
  });

  it('inclui arquivados quando pedido', async () => {
    expect(await names({ includeArchived: true })).toContain('C Pullover');
  });

  it('pesquisa ignora maiúsculas e acentos', async () => {
    expect(await names({ q: 'ROTACAO' })).toEqual([
      'Rotação torácica deitado (open book)',
      'Rotação torácica em quadrupedia',
    ]);
  });

  it('grupo muscular inclui secundários', async () => {
    const glutes = await names({ muscleGroupIds: [ids.muscle('glutes')] });
    expect(glutes).toEqual(expect.arrayContaining(['Hip Thrust', 'Squat', 'RDL']));
    expect(glutes).toHaveLength(7);
  });

  it('filtros combinam-se (E)', async () => {
    expect(
      await names({ kind: 'STRENGTH', region: 'UPPER', movementType: 'PULL', equipmentIds: [ids.equipment('cable')] }),
    ).toEqual(['C Biceps curl']);
    expect(await names({ kind: 'STRENGTH', unilateral: true })).toEqual([
      '1 Leg Hip Thrust', 'Bulgarian Split Squat', 'Lunges',
    ]);
  });

  it('filtra por área de mobilidade', async () => {
    expect(await names({ mobilityAreaIds: [ids.mobilityArea('ankle')] })).toEqual([
      'Agachamento profundo (manter)', 'Mobilidade de tornozelo na parede',
    ]);
  });

  it('get devolve relações e nome do equipamento', async () => {
    const ex = await repo.get(ids.exercise('Squat'));
    expect(ex).toMatchObject({
      name: 'Squat',
      primaryMuscleIds: [ids.muscle('quadriceps')],
      secondaryMuscleIds: [ids.muscle('glutes')],
      equipmentName: null,
    });
    expect((await repo.get(ids.exercise('M Low Row')))?.equipmentName).toBe('Máquina');
    expect(await repo.get('nao-existe')).toBeNull();
  });
});
