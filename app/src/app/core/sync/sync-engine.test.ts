import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { SqliteSessionRepository } from '../../data/repositories/sqlite/sqlite-session.repository';
import { SqliteWorkoutRepository } from '../../data/repositories/sqlite/sqlite-workout.repository';
import { getMeta } from '../db/local-meta';
import { MIGRATIONS } from '../db/migrations';
import { loadSeed } from '../seed/seed-loader';
import { asUser, freshServer } from '../testing/pg-server';
import { createTestDb, TEST_SEED } from '../testing/test-db';
import { FixedClock } from '../util/clock';
import { ids } from '../util/uuid';
import { hasDirty, resetSyncState, syncOnce } from './sync-engine';
import { SyncError, type SyncPullResponse, type SyncPushRequest, type SyncPushResponse, type SyncTransport } from './sync-types';

const SCHEMA = MIGRATIONS.at(-1)!.version;
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const squat = ids.exercise('Squat');

/** Servidor = Postgres real com as funções de supabase/migrations. */
class PgTransport implements SyncTransport {
  pushes = 0;
  pulls = 0;
  fail = false;
  constructor(private readonly pg: PGlite, public user: string = USER) {}

  async push(req: SyncPushRequest): Promise<SyncPushResponse> {
    if (this.fail) throw new SyncError('Sem ligação ao servidor.', 'offline');
    this.pushes++;
    return asUser(this.pg, this.user, async () =>
      (await this.pg.query<{ r: SyncPushResponse }>(`SELECT sync_push($1::jsonb) AS r`, [JSON.stringify(req)])).rows[0].r);
  }
  async pull(since: number, limit = 1000): Promise<SyncPullResponse> {
    if (this.fail) throw new SyncError('Sem ligação ao servidor.', 'offline');
    this.pulls++;
    return asUser(this.pg, this.user, async () =>
      (await this.pg.query<{ r: SyncPullResponse }>(`SELECT sync_pull($1, $2) AS r`, [since, limit])).rows[0].r);
  }
}

async function device(startIso = '2026-10-10T08:00:00.000Z') {
  const t = await createTestDb();
  await loadSeed(t.db, TEST_SEED, t.deviceId);
  const clock = new FixedClock(new Date(startIso));
  return {
    db: t.db,
    deviceId: t.deviceId,
    clock,
    workouts: new SqliteWorkoutRepository(t.db, clock, t.deviceId),
    sessions: new SqliteSessionRepository(t.db, clock, t.deviceId),
    sync: (tr: SyncTransport, opts: { userId?: string; pullPage?: number } = {}) =>
      syncOnce(t.db, tr, { deviceId: t.deviceId, userId: opts.userId ?? USER, schemaVersion: SCHEMA, nowIso: () => clock.nowIso(), pullPage: opts.pullPage }),
  };
}
type Dev = Awaited<ReturnType<typeof device>>;
const all = (d: Dev, table: string) => d.db.query(`SELECT * FROM ${table} ORDER BY id`);

async function train(d: Dev) {
  const w = await d.workouts.save({ name: 'Pernas', items: [{ exerciseId: squat, block: 'MAIN', targetSets: 3, targetReps: 8, targetWeightKg: 60 }] });
  const s = await d.sessions.start({ templateId: w.id });
  await d.sessions.saveSet({ sessionExerciseId: s.exercises[0].id, entries: [{ side: 'BOTH', weightKg: 60, reps: 8 }] });
  d.clock.advance(60_000);
  await d.sessions.saveSet({ sessionExerciseId: s.exercises[0].id, entries: [{ side: 'BOTH', weightKg: 62.5, reps: 6 }] });
  d.clock.advance(1800_000);
  await d.sessions.finish(s.id, { rpe: 8 });
  return { w, s };
}

describe('motor de sync contra Postgres real', () => {
  let pg: PGlite;
  let server: PgTransport;
  beforeEach(async () => {
    pg = await freshServer();
    server = new PgTransport(pg);
  });

  it('um treino feito no dispositivo A aparece no B, idêntico', async () => {
    const a = await device();
    const b = await device();
    await train(a);
    const ra = await a.sync(server);
    expect(ra.pushed).toBeGreaterThan(0);
    const rb = await b.sync(server);
    expect(rb.changed).toBeGreaterThan(0);
    for (const t of ['workout_template', 'planned_exercise', 'session', 'session_exercise', 'set_log']) {
      expect(await all(b, t), t).toEqual(await all(a, t));
    }
  });

  it('depois de sincronizado não há nada por enviar nem por trazer; repetir não faz nada', async () => {
    const a = await device();
    await train(a);
    await a.sync(server);
    expect(await hasDirty(a.db)).toBe(false);
    const pushesBefore = server.pushes;
    const again = await a.sync(server);
    expect(again).toEqual({ pushed: 0, pulled: 0, changed: 0 });
    expect(server.pushes).toBe(pushesBefore); // nem sequer pede um envio vazio
  });

  it('o seed igual nos dois dispositivos não fica a ir e vir', async () => {
    const a = await device();
    const b = await device();
    await a.sync(server);
    await b.sync(server);
    await a.sync(server);
    expect(await hasDirty(a.db)).toBe(false);
    expect(await hasDirty(b.db)).toBe(false);
    expect(await a.sync(server)).toEqual({ pushed: 0, pulled: 0, changed: 0 });
    expect((await b.sync(server)).pushed).toBe(0);
  });

  it('conflito: a edição mais recente ganha nos dois dispositivos', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const b = await device('2026-10-10T08:00:00.000Z');
    const { w } = await train(a);
    await a.sync(server);
    await b.sync(server);

    a.clock.set(new Date('2026-10-10T09:00:00.000Z'));
    b.clock.set(new Date('2026-10-10T10:00:00.000Z'));
    await a.workouts.save({ id: w.id, name: 'Pernas (A)', items: [{ exerciseId: squat, block: 'MAIN', targetSets: 3, targetReps: 8, targetWeightKg: 60 }] });
    await b.workouts.save({ id: w.id, name: 'Pernas (B)', items: [{ exerciseId: squat, block: 'MAIN', targetSets: 3, targetReps: 8, targetWeightKg: 60 }] });

    await a.sync(server); // envia a edição das 9h
    await b.sync(server); // envia a das 10h (ganha) e traz o resto
    await a.sync(server);
    const name = async (d: Dev) => (await d.db.query<{ name: string }>('SELECT name FROM workout_template WHERE id = ?', [w.id]))[0].name;
    expect(await name(a)).toBe('Pernas (B)');
    expect(await name(b)).toBe('Pernas (B)');
  });

  it('arquivar/apagar num dispositivo chega ao outro', async () => {
    const a = await device();
    const b = await device();
    const { w } = await train(a);
    await a.sync(server);
    await b.sync(server);
    a.clock.advance(3600_000);
    await a.workouts.archive(w.id);
    await a.sync(server);
    await b.sync(server);
    const row = (await b.db.query<{ archived_at: string | null }>('SELECT archived_at FROM workout_template WHERE id = ?', [w.id]))[0];
    expect(row.archived_at).not.toBeNull();
  });

  it('com o relógio atrasado a edição não se perde (não depende de «desde a última vez»)', async () => {
    const a = await device('2026-10-10T08:00:00.000Z');
    const { w } = await train(a);
    await a.sync(server);
    // o relógio do telemóvel vai para trás: a edição tem updated_at anterior ao que já foi enviado
    a.clock.set(new Date('2026-10-09T08:00:00.000Z'));
    await a.workouts.save({ id: w.id, name: 'Editado com relógio atrasado', items: [{ exerciseId: squat, block: 'MAIN', targetSets: 3, targetReps: 8, targetWeightKg: 60 }] });
    expect(await hasDirty(a.db)).toBe(true);
    expect((await a.sync(server)).pushed).toBeGreaterThan(0);
  });

  it('falha de rede: nada se perde e o sync seguinte recupera', async () => {
    const a = await device();
    const b = await device();
    await train(a);
    server.fail = true;
    await expect(a.sync(server)).rejects.toThrow(/Sem ligação/);
    expect(await hasDirty(a.db)).toBe(true);
    expect(await getMeta(a.db, 'sync.cursor')).toBeNull();
    server.fail = false;
    await a.sync(server);
    await b.sync(server);
    expect(await all(b, 'set_log')).toEqual(await all(a, 'set_log'));
  });

  it('páginas pequenas: filhos antes dos pais numa página não estragam nada', async () => {
    const a = await device();
    const b = await device();
    const { w } = await train(a);
    await a.sync(server);
    // edita o pai depois dos filhos: o pai passa a ter server_version maior que os filhos
    a.clock.advance(3600_000);
    await a.workouts.save({ id: w.id, name: 'Pernas v2', items: [{ exerciseId: squat, block: 'MAIN', targetSets: 4, targetReps: 8, targetWeightKg: 60 }] });
    await a.sync(server);
    await b.sync(server, { pullPage: 3 });
    expect(await all(b, 'session_exercise')).toEqual(await all(a, 'session_exercise'));
    expect(await all(b, 'workout_template')).toEqual(await all(a, 'workout_template'));
  });

  it('outra conta no mesmo dispositivo recomeça o estado de sync', async () => {
    const a = await device();
    await train(a);
    await a.sync(server);
    expect(await hasDirty(a.db)).toBe(false);
    const other = new PgTransport(pg, OTHER_USER);
    const r = await a.sync(other, { userId: OTHER_USER });
    expect(r.pushed).toBeGreaterThan(0); // tudo vai para a conta nova
  });

  it('resetSyncState volta a enviar tudo', async () => {
    const a = await device();
    await a.sync(server);
    await resetSyncState(a.db);
    expect(await hasDirty(a.db)).toBe(true);
    await a.sync(server);
    expect(await hasDirty(a.db)).toBe(false);
  });
});
