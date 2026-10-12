import { describe, expect, it } from 'vitest';
import { createEmptyDb } from '../testing/test-db';
import { MIGRATIONS } from './migrations';
import { currentSchemaVersion, migrate } from './migrator';

const SYNCED_TABLES = [
  'equipment', 'muscle_group', 'mobility_area', 'exercise', 'exercise_muscle',
  'exercise_mobility_area', 'workout_template', 'planned_exercise', 'scheduled_workout',
  'session', 'session_exercise', 'set_log', 'setting', 'body_metric',
];

async function columns(db: Awaited<ReturnType<typeof createEmptyDb>>, table: string) {
  return (await db.query<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name);
}

describe('migrações', () => {
  it('cria o esquema numa base vazia', async () => {
    const db = await createEmptyDb();
    const result = await migrate(db);
    expect(result).toEqual({ from: 0, to: 9, applied: ['001-init', '002-cardio', '003-sync-state', '004-rir', '005-progress-photo', '006-recovery', '007-health', '008-category', '009-health-detail'] });
    expect(await currentSchemaVersion(db)).toBe(9);

    const tables = (
      await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    ).map((t) => t.name);
    for (const t of [...SYNCED_TABLES, 'local_meta', 'schema_migrations']) expect(tables).toContain(t);
  });

  it('todas as tabelas sincronizáveis têm os campos de sync', async () => {
    const db = await createEmptyDb();
    await migrate(db);
    for (const t of SYNCED_TABLES) {
      const cols = await columns(db, t);
      expect(cols, t).toEqual(expect.arrayContaining(['id', 'updated_at', 'deleted_at', 'device_id']));
    }
  });

  it('é idempotente', async () => {
    const db = await createEmptyDb();
    await migrate(db);
    const again = await migrate(db);
    expect(again.applied).toEqual([]);
    expect(again.from).toBe(9);
  });

  it('uma migração que falha não deixa nada a meio', async () => {
    const db = await createEmptyDb();
    await migrate(db);
    const broken = [
      ...MIGRATIONS,
      { version: 10, name: '010-broken', sql: 'CREATE TABLE half_done (id TEXT); SELECT * FROM nao_existe;' },
    ];
    await expect(migrate(db, broken)).rejects.toThrow();
    expect(await currentSchemaVersion(db)).toBe(9);
    const half = await db.query("SELECT name FROM sqlite_master WHERE name = 'half_done'");
    expect(half).toEqual([]);
  });

  it('002 reconstrói exercise numa base com dados, sem perder linhas nem ligações', async () => {
    const db = await createEmptyDb();
    await migrate(db, MIGRATIONS.slice(0, 1));
    const t = "'2026-10-10T00:00:00.000Z', 'dev'";
    await db.run(`INSERT INTO muscle_group (id, name, updated_at, device_id) VALUES ('m', 'Peito', ${t})`);
    await db.run(`INSERT INTO exercise (id, name, kind, metric_type, archived_at, updated_at, device_id)
                  VALUES ('e', 'Supino', 'STRENGTH', 'WEIGHT_REPS', '2026-01-01', ${t})`);
    await db.run(`INSERT INTO exercise_muscle (id, exercise_id, muscle_group_id, is_primary, updated_at, device_id)
                  VALUES ('em', 'e', 'm', 1, ${t})`);

    expect((await migrate(db)).applied).toEqual(['002-cardio', '003-sync-state', '004-rir', '005-progress-photo', '006-recovery', '007-health', '008-category', '009-health-detail']);
    expect(await db.query('SELECT id, name, archived_at FROM exercise')).toEqual([
      { id: 'e', name: 'Supino', archived_at: '2026-01-01' },
    ]);
    expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
    // chaves estrangeiras voltaram a estar ligadas
    expect(await db.query<{ foreign_keys: number }>('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    await expect(
      db.run(`INSERT INTO exercise_muscle (id, exercise_id, muscle_group_id, updated_at, device_id) VALUES ('x', 'nao', 'm', ${t})`),
    ).rejects.toThrow();
    // cardio aceite só com duração
    await db.run(`INSERT INTO exercise (id, name, kind, metric_type, updated_at, device_id) VALUES ('c', 'Remo', 'CARDIO', 'DURATION', ${t})`);
    await expect(
      db.run(`INSERT INTO exercise (id, name, kind, metric_type, updated_at, device_id) VALUES ('c2', 'X', 'CARDIO', 'REPS', ${t})`),
    ).rejects.toThrow();
    const cols = (await db.query<{ name: string }>('PRAGMA table_info(set_log)')).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['distance_m', 'calories_kcal']));
  });

  it('rejeita migrações fora de sequência', async () => {
    const db = await createEmptyDb();
    await expect(migrate(db, [{ version: 2, name: 'x', sql: '' }])).rejects.toThrow(/sequência/);
  });
});

describe('restrições do esquema', () => {
  const base = "'2026-10-10T00:00:00.000Z', 'dev'";

  it('mobilidade não aceita carga × reps', async () => {
    const db = await createEmptyDb();
    await migrate(db);
    await expect(
      db.run(`INSERT INTO exercise (id, name, kind, metric_type, updated_at, device_id)
              VALUES ('e1', 'X', 'MOBILITY', 'WEIGHT_REPS', ${base})`),
    ).rejects.toThrow();
    await db.run(`INSERT INTO exercise (id, name, kind, metric_type, is_unilateral, updated_at, device_id)
                  VALUES ('e2', 'Y', 'MOBILITY', 'DURATION', 1, ${base})`);
  });

  it('rom_score só de 1 a 5 e lados válidos', async () => {
    const db = await createEmptyDb();
    await migrate(db);
    await db.run(`INSERT INTO exercise (id, name, kind, metric_type, updated_at, device_id)
                  VALUES ('e', 'X', 'MOBILITY', 'DURATION', ${base})`);
    await db.run(`INSERT INTO session (id, started_at, updated_at, device_id)
                  VALUES ('s', '2026-10-10T00:00:00.000Z', ${base})`);
    await db.run(`INSERT INTO session_exercise (id, session_id, exercise_id, position, metric_type, updated_at, device_id)
                  VALUES ('se', 's', 'e', 1, 'DURATION', ${base})`);
    const insertSet = (id: string, extra: string, vals: string) =>
      db.run(`INSERT INTO set_log (id, session_exercise_id, position${extra}, updated_at, device_id)
              VALUES ('${id}', 'se', 1${vals}, ${base})`);
    await insertSet('ok-l', ', side, rom_score', ", 'LEFT', 3");
    await insertSet('ok-r', ', side, rom_score', ", 'RIGHT', 4");
    await expect(insertSet('bad-rom', ', rom_score', ', 6')).rejects.toThrow();
    await expect(insertSet('bad-side', ', side', ", 'UP'")).rejects.toThrow();
  });

  it('chaves estrangeiras estão ativas', async () => {
    const db = await createEmptyDb();
    await migrate(db);
    await expect(
      db.run(`INSERT INTO exercise_muscle (id, exercise_id, muscle_group_id, updated_at, device_id)
              VALUES ('x', 'nao', 'existe', ${base})`),
    ).rejects.toThrow();
  });
});
