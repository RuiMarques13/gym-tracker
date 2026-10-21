import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { ids } from '../../../core/util/uuid';
import { GROUP_DEFAULTS } from '../../../core/session/group-format';
import { SqliteGroupRepository } from './sqlite-group.repository';
import { SqliteSessionRepository } from './sqlite-session.repository';
import { SqliteWorkoutRepository } from './sqlite-workout.repository';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
let db: Db;
let groups: SqliteGroupRepository;
let workouts: SqliteWorkoutRepository;
let sessions: SqliteSessionRepository;
let clock: FixedClock;

const squat = ids.exercise('Squat');
const rdl = ids.exercise('RDL');

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  await loadSeed(db, TEST_SEED, t.deviceId);
  clock = new FixedClock(new Date('2026-10-10T08:00:00.000Z'));
  groups = new SqliteGroupRepository(db, clock, t.deviceId);
  workouts = new SqliteWorkoutRepository(db, clock, t.deviceId);
  sessions = new SqliteSessionRepository(db, clock, t.deviceId);
});

const circuitDay = () => workouts.save({
  name: 'Circuito',
  items: [
    { exerciseId: squat, block: 'MAIN', supersetGroup: 'A', targetSets: 3, targetReps: 12 },
    { exerciseId: rdl, block: 'MAIN', supersetGroup: 'A', targetSets: 3, targetReps: 12 },
  ],
});

describe('SqliteGroupRepository', () => {
  it('grava o formato dos grupos de um treino e apaga os que saem', async () => {
    const w = await circuitDay();
    await groups.saveForTemplate(w.id, [{ groupKey: 'A', config: GROUP_DEFAULTS.TABATA }]);
    expect((await groups.forTemplate(w.id)).map((g) => [g.groupKey, g.kind, g.workSeconds, g.restSeconds, g.rounds])).toEqual([['A', 'TABATA', 20, 10, 8]]);
    await groups.saveForTemplate(w.id, [{ groupKey: 'A', config: { ...GROUP_DEFAULTS.CIRCUIT, rounds: 4 } }]);
    expect((await groups.forTemplate(w.id)).map((g) => [g.kind, g.rounds, g.roundRestSeconds])).toEqual([['CIRCUIT', 4, 90]]);
    await groups.saveForTemplate(w.id, []);
    expect(await groups.forTemplate(w.id)).toEqual([]);
    const rows = await db.query<{ deleted_at: string | null }>('SELECT deleted_at FROM exercise_group WHERE template_id = ?', [w.id]);
    expect(rows.every((r) => r.deleted_at)).toBe(true); // apagamento lógico (sincroniza)
  });

  it('superset simples não precisa de linha', async () => {
    const w = await circuitDay();
    await groups.saveForTemplate(w.id, [{ groupKey: 'A', config: GROUP_DEFAULTS.SUPERSET }]);
    expect(await groups.forTemplate(w.id)).toEqual([]);
  });

  it('começar a sessão copia os formatos; o resultado fica na sessão', async () => {
    const w = await circuitDay();
    await groups.saveForTemplate(w.id, [{ groupKey: 'A', config: GROUP_DEFAULTS.AMRAP }]);
    const s = await sessions.start({ templateId: w.id });
    const g = await groups.forSession(s.id);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ groupKey: 'A', kind: 'AMRAP', durationSeconds: 720, templateId: null, sessionId: s.id });
    await groups.saveResult(s.id, 'A', { rounds: 7, reps: 4, seconds: 720 });
    expect((await groups.forSession(s.id))[0]).toMatchObject({ resultRounds: 7, resultReps: 4, resultSeconds: 720 });
    // O treino não muda.
    expect((await groups.forTemplate(w.id))[0].resultRounds).toBeNull();
  });

  it('último resultado do mesmo grupo do mesmo treino', async () => {
    const w = await circuitDay();
    await groups.saveForTemplate(w.id, [{ groupKey: 'A', config: GROUP_DEFAULTS.AMRAP }]);
    const s1 = await sessions.start({ templateId: w.id });
    await groups.saveResult(s1.id, 'A', { rounds: 6, reps: 2, seconds: 720 });
    await sessions.finish(s1.id);
    clock.set(new Date('2026-10-12T08:00:00.000Z'));
    const s2 = await sessions.start({ templateId: w.id });
    expect(await groups.lastResult(w.id, 'A', s2.id)).toEqual({ rounds: 6, reps: 2, seconds: 720 });
  });

  it('sessão livre: formato criado na sessão', async () => {
    const s = await sessions.start();
    const g = await groups.saveForSession(s.id, 'A', GROUP_DEFAULTS.EMOM);
    expect(g).toMatchObject({ kind: 'EMOM', rounds: 10, workSeconds: 60 });
    await groups.saveForSession(s.id, 'A', { ...GROUP_DEFAULTS.EMOM, rounds: 12 });
    expect((await groups.forSession(s.id)).map((x) => x.rounds)).toEqual([12]);
  });

  it('copiar um treino leva os formatos', async () => {
    const w = await circuitDay();
    await groups.saveForTemplate(w.id, [{ groupKey: 'A', config: GROUP_DEFAULTS.TABATA }]);
    const c = await workouts.copy(w.id);
    expect((await groups.forTemplate(c.id)).map((g) => g.kind)).toEqual(['TABATA']);
  });
});
