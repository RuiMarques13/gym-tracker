import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../core/testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { RecoveryError, SqliteRecoveryRepository } from '../recovery.repository';

let repo: SqliteRecoveryRepository;
let clock: FixedClock;
beforeEach(async () => {
  const t = await createTestDb();
  clock = new FixedClock(new Date('2026-10-10T10:00:00.000Z'));
  repo = new SqliteRecoveryRepository(t.db, clock, t.deviceId);
});

describe('recuperação percebida', () => {
  it('um registo por dia e músculo (substitui), listagem por data e remover', async () => {
    await repo.set('2026-10-09', 'peito', 3);
    await repo.set('2026-10-10', 'peito', 2);
    await repo.set('2026-10-10', 'peito', 4);
    await repo.set('2026-10-10', 'biceps', 1);
    expect(await repo.since('2026-10-10')).toHaveLength(2);
    expect((await repo.since('2026-10-01')).filter((r) => r.muscle === 'peito').map((r) => r.level)).toEqual([4, 3]);
    await repo.clear('2026-10-10', 'peito');
    expect((await repo.since('2026-10-10')).map((r) => r.muscle)).toEqual(['biceps']);
    await repo.set('2026-10-10', 'peito', 5); // volta a ativar o mesmo registo
    expect((await repo.since('2026-10-10')).find((r) => r.muscle === 'peito')?.level).toBe(5);
  });
  it('valida', async () => {
    await expect(repo.set('hoje', 'peito', 3)).rejects.toThrow(RecoveryError);
    await expect(repo.set('2026-10-10', 'peito', 6)).rejects.toThrow(RecoveryError);
    await expect(repo.set('2026-10-10', ' ', 3)).rejects.toThrow(RecoveryError);
  });
});
