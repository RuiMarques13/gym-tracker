import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../../core/seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../../core/testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { ids } from '../../../core/util/uuid';
import { ScheduleError } from '../../models/scheduled';
import { SqliteScheduledRepository } from '../scheduled.repository';
import { SqliteSessionRepository } from './sqlite-session.repository';
import { SqliteWorkoutRepository } from './sqlite-workout.repository';

let repo: SqliteScheduledRepository;
let workouts: SqliteWorkoutRepository;
let sessions: SqliteSessionRepository;
let clock: FixedClock;
let legs: string, upper: string;

beforeEach(async () => {
  const t = await createTestDb();
  await loadSeed(t.db, TEST_SEED, t.deviceId);
  clock = new FixedClock(new Date('2026-10-05T08:00:00.000Z'));
  repo = new SqliteScheduledRepository(t.db, clock, t.deviceId);
  workouts = new SqliteWorkoutRepository(t.db, clock, t.deviceId);
  sessions = new SqliteSessionRepository(t.db, clock, t.deviceId);
  legs = (await workouts.save({ name: 'Pernas', items: [{ exerciseId: ids.exercise('Squat'), block: 'MAIN', targetSets: 3, targetReps: 8 }] })).id;
  upper = (await workouts.save({ name: 'Upper', items: [] })).id;
});

describe('SqliteScheduledRepository', () => {
  it('planeia, lista por intervalo e dá o próximo por fazer', async () => {
    const a = await repo.schedule('2026-10-07', legs);
    await repo.schedule('2026-10-09', upper);
    await repo.schedule('2026-10-20', upper);
    expect((await repo.list('2026-10-05', '2026-10-11')).map((w) => [w.date, w.templateName, w.status])).toEqual([
      ['2026-10-07', 'Pernas', 'PLANNED'], ['2026-10-09', 'Upper', 'PLANNED'],
    ]);
    expect((await repo.next('2026-10-05'))?.id).toBe(a.id);
    await repo.setStatus(a.id, 'SKIPPED');
    expect((await repo.next('2026-10-05'))?.templateName).toBe('Upper');
    expect(await repo.next('2026-10-21')).toBeNull();
  });

  it('muda de dia, apaga e valida', async () => {
    const a = await repo.schedule('2026-10-07', legs);
    await repo.move(a.id, '2026-10-08');
    expect((await repo.list('2026-10-08', '2026-10-08')).length).toBe(1);
    await repo.remove(a.id);
    expect(await repo.list('2026-10-01', '2026-10-31')).toEqual([]);
    await expect(repo.schedule('10/10/2026', legs)).rejects.toThrow(ScheduleError);
    await expect(repo.schedule('2026-10-10', 'nao-existe')).rejects.toThrow(/já não existe/);
    await workouts.archive(upper);
    await expect(repo.schedule('2026-10-10', upper)).rejects.toThrow(ScheduleError);
  });

  it('terminar uma sessão iniciada a partir de um planeado marca-o como feito', async () => {
    const a = await repo.schedule('2026-10-05', legs);
    const s = await sessions.start({ templateId: legs, scheduledId: a.id });
    expect(s.scheduledId).toBe(a.id);
    expect((await repo.list('2026-10-05', '2026-10-05'))[0].status).toBe('PLANNED'); // ainda em curso
    await sessions.finish(s.id);
    expect((await repo.list('2026-10-05', '2026-10-05'))[0].status).toBe('DONE');
  });

  it('descartar a sessão deixa o planeado por fazer', async () => {
    const a = await repo.schedule('2026-10-05', legs);
    const s = await sessions.start({ templateId: legs, scheduledId: a.id });
    await sessions.discard(s.id);
    expect((await repo.list('2026-10-05', '2026-10-05'))[0].status).toBe('PLANNED');
  });
});
