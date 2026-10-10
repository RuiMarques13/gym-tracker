import { describe, expect, it } from 'vitest';
import { setMeta } from '../db/local-meta';
import { createTestDb, TEST_SEED } from '../testing/test-db';
import { ids } from '../util/uuid';
import { LEGACY_EXERCISES, SEED } from './seed.generated';
import { loadSeed, SEED_UPDATED_AT } from './seed-loader';

const count = async (db: Awaited<ReturnType<typeof createTestDb>>['db'], table: string) =>
  (await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0].n;

const allIds = async (db: Awaited<ReturnType<typeof createTestDb>>['db']) => {
  const tables = ['equipment', 'muscle_group', 'mobility_area', 'exercise', 'exercise_muscle', 'exercise_mobility_area'];
  const out: Record<string, string[]> = {};
  for (const t of tables) {
    out[t] = (await db.query<{ id: string }>(`SELECT id FROM ${t} ORDER BY id`)).map((r) => r.id);
  }
  return out;
};

describe('seed (mecânica, com os 39 exercícios antigos)', () => {
  it('carrega o catálogo completo (25 força + 14 mobilidade)', async () => {
    const { db, deviceId } = await createTestDb();
    const result = await loadSeed(db, TEST_SEED, deviceId);
    expect(result.skipped).toBe(false);

    const kinds = await db.query<{ kind: string; n: number }>(
      'SELECT kind, COUNT(*) AS n FROM exercise GROUP BY kind ORDER BY kind',
    );
    expect(kinds).toEqual([
      { kind: 'MOBILITY', n: 14 },
      { kind: 'STRENGTH', n: 25 },
    ]);
    expect(await count(db, 'muscle_group')).toBe(SEED.muscles.length);
    expect(await count(db, 'equipment')).toBe(SEED.equipment.length);
  });

  it('classifica como no documento', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, TEST_SEED, deviceId);

    const squat = (await db.query<Record<string, unknown>>('SELECT * FROM exercise WHERE id = ?', [ids.exercise('Squat')]))[0];
    expect(squat).toMatchObject({ name: 'Squat', region: 'LOWER', movement_type: 'PUSH', metric_type: 'WEIGHT_REPS', equipment_id: null });

    const muscles = await db.query<{ name: string; is_primary: number }>(
      `SELECT m.name, em.is_primary FROM exercise_muscle em JOIN muscle_group m ON m.id = em.muscle_group_id
       WHERE em.exercise_id = ? ORDER BY em.is_primary DESC`,
      [ids.exercise('Squat')],
    );
    expect(muscles).toEqual([
      { name: 'Quadríceps', is_primary: 1 },
      { name: 'Glúteos', is_primary: 0 },
    ]);

    const unilateral = (
      await db.query<{ name: string }>(
        "SELECT name FROM exercise WHERE kind = 'STRENGTH' AND is_unilateral = 1 ORDER BY name",
      )
    ).map((r) => r.name);
    expect(unilateral).toEqual(['1 Leg Hip Thrust', 'Bulgarian Split Squat', 'Lunges']);

    const chestPress = (await db.query<{ equipment_id: string }>('SELECT equipment_id FROM exercise WHERE name = ?', ['M Chest Press']))[0];
    expect(chestPress.equipment_id).toBe(ids.equipment('machine'));

    const wgs = await db.query<{ name: string }>(
      `SELECT a.name FROM exercise_mobility_area x JOIN mobility_area a ON a.id = x.mobility_area_id
       WHERE x.exercise_id = ? ORDER BY a.name`,
      [ids.exercise("World's greatest stretch")],
    );
    expect(wgs.map((r) => r.name)).toEqual(['Anca', 'Coluna torácica']);

    const restMobility = await db.query("SELECT 1 FROM exercise WHERE kind = 'MOBILITY' AND default_rest_seconds IS NOT NULL");
    expect(restMobility).toEqual([]);
  });

  it('não volta a correr com a mesma versão', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, TEST_SEED, deviceId);
    expect((await loadSeed(db, TEST_SEED, deviceId)).skipped).toBe(true);
  });

  it('repetir o seed não duplica nem sobrepõe edições', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, TEST_SEED, deviceId);
    const before = await count(db, 'exercise');

    await db.run("UPDATE exercise SET name = 'Agachamento', updated_at = '2026-10-10T10:00:00.000Z' WHERE id = ?", [ids.exercise('Squat')]);
    await db.run("UPDATE exercise SET archived_at = '2026-10-10T10:00:00.000Z' WHERE id = ?", [ids.exercise('Lunges')]);
    await setMeta(db, 'seed_version', '0');
    await loadSeed(db, TEST_SEED, deviceId);

    expect(await count(db, 'exercise')).toBe(before);
    const squat = (await db.query<{ name: string }>('SELECT name FROM exercise WHERE id = ?', [ids.exercise('Squat')]))[0];
    expect(squat.name).toBe('Agachamento');
    const lunges = (await db.query<{ archived_at: string }>('SELECT archived_at FROM exercise WHERE id = ?', [ids.exercise('Lunges')]))[0];
    expect(lunges.archived_at).not.toBeNull();
  });

  it('dois dispositivos independentes geram exatamente os mesmos IDs', async () => {
    const a = await createTestDb();
    const b = await createTestDb();
    expect(a.deviceId).not.toBe(b.deviceId);
    await loadSeed(a.db, TEST_SEED, a.deviceId);
    await loadSeed(b.db, TEST_SEED, b.deviceId);
    expect(await allIds(a.db)).toEqual(await allIds(b.db));
  });

  it('linhas de seed têm updated_at fixo, para qualquer edição ganhar no sync', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, TEST_SEED, deviceId);
    const distinct = await db.query<{ updated_at: string }>('SELECT DISTINCT updated_at FROM exercise');
    expect(distinct).toEqual([{ updated_at: SEED_UPDATED_AT }]);
  });
});

describe('seed de produção (v4)', () => {
  it('não cria exercícios numa instalação nova', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, SEED, deviceId);
    expect(await count(db, 'exercise')).toBe(0);
    expect(await count(db, 'muscle_group')).toBe(SEED.muscles.length);
  });

  it('retira os 39 de bases antigas, arquiva os usados e não toca nos teus', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, { ...TEST_SEED, version: 3 }, deviceId);
    expect(await count(db, 'exercise')).toBe(39);
    // um exercício teu e um antigo usado num treino
    await db.run(`INSERT INTO exercise (id, name, kind, metric_type, updated_at, device_id)
                  VALUES ('meu', 'Meu exercício', 'STRENGTH', 'REPS', '2026-10-10T00:00:00Z', ?)`, [deviceId]);
    await db.run("INSERT INTO workout_template (id, name, updated_at, device_id) VALUES ('t', 'A', '2026-10-10T00:00:00Z', 'd')");
    await db.run(`INSERT INTO planned_exercise (id, template_id, exercise_id, position, updated_at, device_id)
                  VALUES ('p', 't', ?, 1, '2026-10-10T00:00:00Z', 'd')`, [ids.exercise('Squat')]);

    await loadSeed(db, SEED, deviceId, () => '2026-10-10T09:00:00.000Z');

    const active = await db.query<{ name: string; archived_at: string | null }>(
      'SELECT name, archived_at FROM exercise WHERE deleted_at IS NULL ORDER BY name',
    );
    expect(active).toEqual([
      { name: 'Meu exercício', archived_at: null },
      { name: 'Squat', archived_at: '2026-10-10T09:00:00.000Z' },
    ]);
    const deleted = await db.query<{ n: number; t: string }>(
      'SELECT COUNT(*) AS n, MAX(updated_at) AS t FROM exercise WHERE deleted_at IS NOT NULL',
    );
    expect(deleted[0]).toEqual({ n: 38, t: '2026-10-10T09:00:00.000Z' });
    const links = await db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM exercise_muscle em JOIN exercise e ON e.id = em.exercise_id
       WHERE e.deleted_at IS NOT NULL AND em.deleted_at IS NULL`,
    );
    expect(links[0].n).toBe(0);
    expect(LEGACY_EXERCISES).toHaveLength(39);
  });
});
