import { describe, expect, it } from 'vitest';
import { SqliteSessionRepository } from '../repositories/sqlite/sqlite-session.repository';
import { SqliteWorkoutRepository } from '../repositories/sqlite/sqlite-workout.repository';
import { MIGRATIONS } from '../db/migrations';
import { loadSeed } from '../seed/seed-loader';
import { createTestDb, TEST_SEED } from '../testing/test-db';
import { FixedClock } from '../../core/util/clock';
import { ids } from '../../core/util/uuid';
import { exportData, incomingWins, mergeData, MergeError, parseExport, previewMerge } from './merge';

const SCHEMA = MIGRATIONS.at(-1)!.version;
const squat = ids.exercise('Squat');
const pigeon = ids.exercise('Pombo (pigeon)');

async function device(startIso: string) {
  const t = await createTestDb();
  await loadSeed(t.db, TEST_SEED, t.deviceId);
  const clock = new FixedClock(new Date(startIso));
  return {
    db: t.db,
    deviceId: t.deviceId,
    clock,
    workouts: new SqliteWorkoutRepository(t.db, clock, t.deviceId),
    sessions: new SqliteSessionRepository(t.db, clock, t.deviceId),
    export: () => exportData(t.db, { schemaVersion: SCHEMA, deviceId: t.deviceId, nowIso: clock.nowIso() }),
  };
}
type Dev = Awaited<ReturnType<typeof device>>;

async function train(d: Dev) {
  const w = await d.workouts.save({
    name: 'Pernas',
    items: [{ exerciseId: squat, block: 'MAIN', targetSets: 3, targetReps: 8, targetWeightKg: 60 }],
  });
  const s = await d.sessions.start({ templateId: w.id });
  const ex = s.exercises[0];
  await d.sessions.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
  d.clock.advance(60_000);
  await d.sessions.saveSet({ sessionExerciseId: ex.id, entries: [{ side: 'BOTH', weightKg: 62.5, reps: 6 }] });
  d.clock.advance(1800_000);
  await d.sessions.finish(s.id, { rpe: 8 });
  return { w, s };
}
const all = (d: Dev, table: string) => d.db.query(`SELECT * FROM ${table} ORDER BY id`);

describe('merge LWW', () => {
  it('leva uma sessão completa de um dispositivo para outro e converge', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-10T08:00:00.000Z');
    const { s } = await train(a);
    const file = parseExport(JSON.stringify(await a.export()), SCHEMA);
    const report = await mergeData(b.db, file);
    expect(report.tables.session).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(report.tables.set_log?.inserted).toBe(2);
    expect(await all(b, 'set_log')).toEqual(await all(a, 'set_log'));
    expect(await all(b, 'session')).toEqual(await all(a, 'session'));
    expect((await b.sessions.get(s.id))!.exercises[0].sets.map((x) => x.weightKg)).toEqual([60, 62.5]);
  });

  it('importar duas vezes não muda nada (idempotente) e a pré-visualização não escreve', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-10T08:00:00.000Z');
    await train(a);
    const file = parseExport(JSON.stringify(await a.export()), SCHEMA);
    const preview = await previewMerge(b.db, file);
    expect(preview.tables.session?.inserted).toBe(1);
    expect(await all(b, 'session')).toEqual([]);
    await mergeData(b.db, file);
    const again = await mergeData(b.db, file);
    expect(again.inserted).toBe(0);
    expect(again.updated).toBe(0);
  });

  it('última escrita ganha: a edição mais recente vence, em qualquer sentido', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-10T08:00:00.000Z');
    // A renomeia às 09:00, B às 10:00
    a.clock.set(new Date('2026-10-10T09:00:00.000Z'));
    await a.db.run('UPDATE exercise SET name = ?, updated_at = ?, device_id = ? WHERE id = ?', ['Squat A', a.clock.nowIso(), a.deviceId, squat]);
    b.clock.set(new Date('2026-10-10T10:00:00.000Z'));
    await b.db.run('UPDATE exercise SET name = ?, updated_at = ?, device_id = ? WHERE id = ?', ['Squat B', b.clock.nowIso(), b.deviceId, squat]);
    const fa = parseExport(JSON.stringify(await a.export()), SCHEMA);
    const fb = parseExport(JSON.stringify(await b.export()), SCHEMA);
    const rA = await mergeData(a.db, fb);
    const rB = await mergeData(b.db, fa);
    const name = async (d: Dev) => (await d.db.query<{ name: string }>('SELECT name FROM exercise WHERE id = ?', [squat]))[0].name;
    expect(await name(a)).toBe('Squat B');
    expect(await name(b)).toBe('Squat B');
    expect(rA.tables.exercise?.updated).toBe(1);
    expect(rB.tables.exercise?.updated ?? 0).toBe(0);
    // as linhas do seed, iguais nos dois, não contam como alteração; o resto fica igual (salvo o device_id do seed)
    const strip = async (d: Dev) => (await all(d, 'exercise')).map(({ device_id, ...r }) => r);
    expect(await strip(a)).toEqual(await strip(b));
  });

  it('apagar (soft delete) mais recente propaga; um edit posterior ressuscita', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-10T08:00:00.000Z');
    const w = await a.workouts.save({ name: 'X', items: [] });
    await mergeData(b.db, parseExport(JSON.stringify(await a.export()), SCHEMA));
    a.clock.advance(3600_000);
    await a.workouts.remove(w.id);
    await mergeData(b.db, parseExport(JSON.stringify(await a.export()), SCHEMA));
    expect(await b.workouts.get(w.id)).toBeNull();
    // B volta a gravar o treino mais tarde: ressuscita em A
    b.clock.set(new Date('2026-10-10T12:00:00.000Z'));
    await b.db.run('UPDATE workout_template SET deleted_at = NULL, updated_at = ?, device_id = ? WHERE id = ?', [b.clock.nowIso(), b.deviceId, w.id]);
    await mergeData(a.db, parseExport(JSON.stringify(await b.export()), SCHEMA));
    expect((await a.workouts.get(w.id))?.name).toBe('X');
  });

  it('definições deste dispositivo não viajam; as da conta sim', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-10T08:00:00.000Z');
    const now = a.clock.nowIso();
    await a.db.run(`INSERT INTO setting (id, key, scope, scope_ref, value, updated_at, device_id) VALUES ('s1','ui.theme','DEVICE','d','{"v":1,"value":"dark"}',?,?)`, [now, a.deviceId]);
    await a.db.run(`INSERT INTO setting (id, key, scope, scope_ref, value, updated_at, device_id) VALUES ('s2','timer.defaultRestSeconds','ACCOUNT',NULL,'{"v":1,"value":120}',?,?)`, [now, a.deviceId]);
    const file = await a.export();
    expect(file.tables.setting?.map((r) => r['id'])).toEqual(['s2']);
    // um ficheiro adulterado com uma linha DEVICE também é ignorado ao importar
    file.tables.setting!.push({ ...(await a.db.query<Record<string, never>>(`SELECT * FROM setting WHERE id = 's1'`))[0] });
    await mergeData(b.db, parseExport(JSON.stringify(file), SCHEMA));
    expect((await b.db.query<{ id: string }>('SELECT id FROM setting ORDER BY id')).map((r) => r.id)).toEqual(['s2']);
  });

  it('rejeita ficheiros que não são válidos, sem tocar na base', async () => {
    expect(() => parseExport('{isto não é json', SCHEMA)).toThrow(MergeError);
    expect(() => parseExport('{"format":"outro"}', SCHEMA)).toThrow(/não é uma exportação/);
    const a = await device('2026-10-10T08:00:00.000Z');
    const good = await a.export();
    expect(() => parseExport(JSON.stringify({ ...good, schemaVersion: SCHEMA + 1 }), SCHEMA)).toThrow(/mais recente/);
    expect(() => parseExport(JSON.stringify({ ...good, version: 99 }), SCHEMA)).toThrow(/mais recente/);
    const bad = { ...good, tables: { exercise: [{ id: 5 }] } };
    expect(() => parseExport(JSON.stringify(bad), SCHEMA)).toThrow(/Linha inválida/);
  });

  it('tudo ou nada: um ficheiro com referências em falta não deixa nada pela metade', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-10T08:00:00.000Z');
    await train(a);
    const file = await a.export();
    file.tables.set_log = file.tables.set_log!.map((r) => ({ ...r, session_exercise_id: 'nao-existe' }));
    await expect(mergeData(b.db, parseExport(JSON.stringify(file), SCHEMA))).rejects.toThrow(MergeError);
    expect(await all(b, 'session')).toEqual([]);
    expect(await all(b, 'workout_template')).toEqual([]);
  });

  it('aceita ficheiros de um esquema mais antigo (colunas em falta ficam por defeito)', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-10T08:00:00.000Z');
    await train(a);
    const file = await a.export();
    for (const r of file.tables.set_log!) { delete r['distance_m']; delete r['calories_kcal']; }
    const older = { ...file, schemaVersion: 1 };
    const report = await mergeData(b.db, parseExport(JSON.stringify(older), SCHEMA));
    expect(report.tables.set_log?.inserted).toBe(2);
  });

  it('empate no updated_at desfaz-se por device_id, igual nos dois sentidos', () => {
    const x = { updated_at: 't', device_id: 'a' };
    const y = { updated_at: 't', device_id: 'b' };
    expect(incomingWins(y, x)).toBe(true);
    expect(incomingWins(x, y)).toBe(false);
    expect(incomingWins(x, x)).toBe(false);
  });

  it('as sessões de B e de A juntam-se sem se pisarem', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-11T08:00:00.000Z');
    await train(a);
    const eb = await b.sessions.start();
    await b.sessions.addExercise(eb.id, pigeon);
    await b.sessions.finish(eb.id);
    await mergeData(a.db, parseExport(JSON.stringify(await b.export()), SCHEMA));
    await mergeData(b.db, parseExport(JSON.stringify(await a.export()), SCHEMA));
    expect((await a.sessions.listFinished()).length).toBe(2);
    expect((await b.sessions.listFinished()).length).toBe(2);
    expect(await all(a, 'session_exercise')).toEqual(await all(b, 'session_exercise'));
  });
});
