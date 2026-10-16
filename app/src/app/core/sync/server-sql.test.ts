import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { SqliteSessionRepository } from '../../data/repositories/sqlite/sqlite-session.repository';
import { SqliteWorkoutRepository } from '../../data/repositories/sqlite/sqlite-workout.repository';
import { MIGRATIONS } from '../db/migrations';
import { exportData, MERGE_TABLES, mergeData } from '../merge/merge';
import { loadSeed } from '../seed/seed-loader';
import { asUser, freshServer } from '../testing/pg-server';
import { createTestDb, TEST_SEED } from '../testing/test-db';
import { FixedClock } from '../util/clock';
import { ids } from '../util/uuid';

/** Corre as migrações de supabase/migrations num Postgres real (PGlite) e testa o contrato sync_push / sync_pull. */
const SCHEMA = MIGRATIONS.at(-1)!.version;
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const push = (pg: PGlite, user: string | null, tables: Tables, protocol = 1) =>
  asUser(pg, user, async () => {
    const r = await pg.query<{ r: Row }>(`SELECT sync_push($1::jsonb) AS r`, [
      JSON.stringify({ protocol_version: protocol, device_id: 'dev', tables }),
    ]);
    return r.rows[0].r as { applied: Record<string, number>; skipped: Record<string, number> };
  });

const pull = (pg: PGlite, user: string | null, since = 0, limit = 1000) =>
  asUser(pg, user, async () => {
    const r = await pg.query<{ r: Row }>(`SELECT sync_pull($1, $2) AS r`, [since, limit]);
    return r.rows[0].r as { cursor: number; has_more: boolean; tables: Tables };
  });

const base = (id: string, over: Row = {}): Row => ({
  id, updated_at: '2026-10-10T10:00:00.000Z', deleted_at: null, device_id: 'dev-a', ...over,
});

describe('servidor Postgres: sync_push / sync_pull', () => {
  let pg: PGlite;
  beforeEach(async () => {
    pg = await freshServer();
  });

  it('as migrações aplicam-se e a RLS está ativa em todas as tabelas', async () => {
    const r = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`);
    expect(r.rows.length).toBe(MERGE_TABLES.length);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });

  it('o papel de API não lê nem escreve tabelas diretamente', async () => {
    await asUser(pg, USER_A, async () => {
      await expect(pg.query(`SELECT * FROM exercise`)).rejects.toThrow(/permission denied/);
      await expect(pg.query(`INSERT INTO equipment (user_id,id,name,updated_at,device_id) VALUES ($1, gen_random_uuid(), 'x', now(), 'd')`, [USER_A]))
        .rejects.toThrow(/permission denied/);
    });
  });

  it('sem utilizador autenticado, recusa', async () => {
    await expect(push(pg, null, {})).rejects.toThrow(/not authenticated/);
    await expect(pull(pg, null)).rejects.toThrow(/not authenticated/);
  });

  it('recusa versão de protocolo desconhecida e payload inválido', async () => {
    await expect(push(pg, USER_A, {}, 2)).rejects.toThrow(/protocol_version/);
    await asUser(pg, USER_A, async () => {
      await expect(pg.query(`SELECT sync_push('{"protocol_version":1}'::jsonb)`)).rejects.toThrow(/invalid payload/);
    });
  });

  it('LWW: ganha o updated_at maior; empate e mais antigo não reescrevem; device_id desempata', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const get = async () => (await pull(pg, USER_A)).tables.equipment!.find((r) => r.id === id)!;

    await push(pg, USER_A, { equipment: [{ ...base(id), name: 'v1' }] });
    expect((await get()).name).toBe('v1');

    let res = await push(pg, USER_A, { equipment: [{ ...base(id, { updated_at: '2026-10-10T09:00:00.000Z' }), name: 'velho' }] });
    expect(res.skipped.equipment).toBe(1);
    expect((await get()).name).toBe('v1');

    res = await push(pg, USER_A, { equipment: [{ ...base(id), name: 'empate' }] });
    expect(res.skipped.equipment).toBe(1);
    expect((await get()).name).toBe('v1');

    res = await push(pg, USER_A, { equipment: [{ ...base(id, { device_id: 'dev-b' }), name: 'desempate' }] });
    expect(res.applied.equipment).toBe(1);
    expect((await get()).name).toBe('desempate');

    res = await push(pg, USER_A, { equipment: [{ ...base(id, { updated_at: '2026-10-10T11:00:00.000Z' }), name: 'novo' }] });
    expect(res.applied.equipment).toBe(1);
    expect((await get()).name).toBe('novo');
    expect((await get()).updated_at).toBe('2026-10-10T11:00:00.000Z');
  });

  it('updated_at no futuro é limitado ao relógio do servidor', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    await push(pg, USER_A, { equipment: [{ ...base(id, { updated_at: '2999-01-01T00:00:00.000Z' }), name: 'futuro' }] });
    const row = (await pull(pg, USER_A)).tables.equipment![0];
    expect(String(row.updated_at) < '2100').toBe(true);
  });

  it('isolamento entre utilizadores, mesmo com o mesmo id (IDs do seed são iguais)', async () => {
    const id = '55555555-5555-4555-8555-555555555555';
    await push(pg, USER_A, { equipment: [{ ...base(id), name: 'do A' }] });
    await push(pg, USER_B, { equipment: [{ ...base(id), name: 'do B' }] });
    expect((await pull(pg, USER_A)).tables.equipment).toHaveLength(1);
    expect((await pull(pg, USER_A)).tables.equipment![0].name).toBe('do A');
    expect((await pull(pg, USER_B)).tables.equipment![0].name).toBe('do B');
  });

  it('uma linha com user_id de outro utilizador no payload é ignorada (vale o JWT)', async () => {
    const id = '66666666-6666-4666-8666-666666666666';
    await push(pg, USER_A, { equipment: [{ ...base(id), name: 'fraude', user_id: USER_B }] });
    expect((await pull(pg, USER_B)).tables.equipment).toBeUndefined();
    expect((await pull(pg, USER_A)).tables.equipment).toHaveLength(1);
  });

  it('pull por cursor: só traz o que mudou e pagina sem perder linhas', async () => {
    const mk = (n: number) => base(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, { name: `e${n}` });
    await push(pg, USER_A, { equipment: Array.from({ length: 7 }, (_, i) => mk(i + 1)) });
    const seen: unknown[] = [];
    let cursor = 0;
    for (let guard = 0; guard < 10; guard++) {
      const p = await pull(pg, USER_A, cursor, 3);
      (p.tables.equipment ?? []).forEach((r) => seen.push(r.name));
      cursor = p.cursor;
      if (!p.has_more) break;
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    const none = await pull(pg, USER_A, cursor);
    expect(none.tables).toEqual({});
    expect(none.cursor).toBe(cursor);

    await push(pg, USER_A, { equipment: [{ ...mk(3), name: 'e3 editado', updated_at: '2026-10-10T12:00:00.000Z' }] });
    const delta = await pull(pg, USER_A, cursor);
    expect(delta.tables.equipment!.map((r) => r.name)).toEqual(['e3 editado']);
  });

  it('as definições do dispositivo não chegam ao servidor', async () => {
    const mk = (id: string, scope: string) => ({ ...base(id), key: 'k', scope, scope_ref: null, value: '{"v":1,"value":1}' });
    const res = await push(pg, USER_A, {
      setting: [mk('77777777-7777-4777-8777-777777777771', 'DEVICE'), mk('77777777-7777-4777-8777-777777777772', 'ACCOUNT')],
    });
    expect(res.applied.setting).toBe(1);
    expect((await pull(pg, USER_A)).tables.setting).toHaveLength(1);
  });

  it('chave estrangeira em falta falha no fim do lote e desfaz tudo', async () => {
    const ex = {
      ...base('88888888-8888-4888-8888-888888888881'), name: 'X', kind: 'STRENGTH', metric_type: 'REPS', is_unilateral: 0, is_isometric: 0,
      equipment_id: '99999999-9999-4999-8999-999999999999',
    };
    await expect(push(pg, USER_A, { exercise: [ex] })).rejects.toThrow(/foreign key/i);
    expect((await pull(pg, USER_A)).tables).toEqual({});
  });

  it('dados reais da app: SQLite → servidor → outro SQLite, idêntico', async () => {
    const t = await createTestDb();
    await loadSeed(t.db, TEST_SEED, t.deviceId);
    const clock = new FixedClock(new Date('2026-10-10T08:00:00.000Z'));
    const workouts = new SqliteWorkoutRepository(t.db, clock, t.deviceId);
    const sessions = new SqliteSessionRepository(t.db, clock, t.deviceId);
    const w = await workouts.save({
      name: 'Pernas',
      items: [{ exerciseId: ids.exercise('Squat'), block: 'MAIN', targetSets: 3, targetReps: 8, targetWeightKg: 60 }],
    });
    const s = await sessions.start({ templateId: w.id });
    await sessions.saveSet({ sessionExerciseId: s.exercises[0].id, entries: [{ side: 'BOTH', weightKg: 62.5, reps: 6 }] });
    clock.advance(1800_000);
    await sessions.finish(s.id, { rpe: 8 });

    const file = await exportData(t.db, { schemaVersion: SCHEMA, deviceId: t.deviceId, nowIso: clock.nowIso() });
    const res = await push(pg, USER_A, file.tables as Tables);
    for (const tbl of MERGE_TABLES) expect(res.skipped[tbl] ?? 0).toBe(0);

    const p = await pull(pg, USER_A, 0, 5000);
    expect(p.has_more).toBe(false);
    for (const tbl of MERGE_TABLES) {
      expect(p.tables[tbl]?.length ?? 0, tbl).toBe(file.tables[tbl]?.length ?? 0);
    }

    // aplica o que veio do servidor numa base vazia, com a mesma regra de merge, e compara
    const other = await createTestDb();
    await mergeData(other.db, { ...file, tables: p.tables as never });
    for (const tbl of ['exercise', 'session', 'session_exercise', 'set_log', 'workout_template', 'planned_exercise']) {
      const a = await t.db.query(`SELECT * FROM ${tbl} ORDER BY id`);
      const b = await other.db.query(`SELECT * FROM ${tbl} ORDER BY id`);
      expect(b, tbl).toEqual(a);
    }

    // voltar a enviar o mesmo não escreve nada
    const again = await push(pg, USER_A, file.tables as Tables);
    for (const tbl of MERGE_TABLES) expect(again.applied[tbl] ?? 0, tbl).toBe(0);
  });

  it('delete_my_data apaga só os dados do utilizador autenticado', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await push(pg, USER_A, { equipment: [{ ...base(id), name: 'a' }] });
    await push(pg, USER_B, { equipment: [{ ...base(id), name: 'b' }] });
    await asUser(pg, USER_A, () => pg.query(`SELECT delete_my_data()`));
    expect((await pull(pg, USER_A)).tables).toEqual({});
    expect((await pull(pg, USER_B)).tables.equipment).toHaveLength(1);
  });

  it('delete_my_photos apaga só as fotos do utilizador autenticado e deixa o resto', async () => {
    const photo = (id: string) => ({ ...base(id), date: '2026-10-10', pose: 'FRONT', note: null, image: 'data:image/jpeg;base64,AAAA' });
    const eq = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const p1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await push(pg, USER_A, { equipment: [{ ...base(eq), name: 'a' }], progress_photo: [photo(p1)] });
    await push(pg, USER_B, { progress_photo: [photo(p1)] });
    const r = await asUser(pg, USER_A, async () => (await pg.query<{ r: Row }>(`SELECT delete_my_photos() AS r`)).rows[0].r);
    expect(r).toEqual({ progress_photo: 1 });
    const a = await pull(pg, USER_A);
    expect(a.tables.progress_photo).toBeUndefined();
    expect(a.tables.equipment).toHaveLength(1);
    expect((await pull(pg, USER_B)).tables.progress_photo).toHaveLength(1);
  });

  it('delete_my_photos exige sessão iniciada', async () => {
    await expect(asUser(pg, null, () => pg.query(`SELECT delete_my_photos()`))).rejects.toThrow(/not authenticated/);
  });
});
