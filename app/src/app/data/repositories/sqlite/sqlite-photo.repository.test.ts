import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../core/testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { PhotoError } from '../../models/photo';
import { SqlitePhotoRepository } from '../photo.repository';

const IMG = 'data:image/jpeg;base64,/9j/4AAQ';
let repo: SqlitePhotoRepository;
let clock: FixedClock;

beforeEach(async () => {
  const t = await createTestDb();
  clock = new FixedClock(new Date('2026-10-10T10:00:00.000Z'));
  repo = new SqlitePhotoRepository(t.db, clock, t.deviceId);
});

describe('fotos de progresso', () => {
  it('guarda, lista da mais recente para a mais antiga, edita e apaga (soft delete)', async () => {
    const a = await repo.add({ date: '2026-09-01', pose: 'FRONT', image: IMG });
    const b = await repo.add({ date: '2026-10-01', pose: 'SIDE', note: '  depois do verão ', image: IMG });
    expect((await repo.list()).map((p) => p.id)).toEqual([b.id, a.id]);
    expect((await repo.list())[0].note).toBe('depois do verão');
    await repo.update(a.id, { date: '2026-10-05', pose: 'BACK' });
    expect((await repo.list()).map((p) => [p.id, p.date, p.pose])).toEqual([[a.id, '2026-10-05', 'BACK'], [b.id, '2026-10-01', 'SIDE']]);
    await repo.remove(a.id);
    expect((await repo.list()).map((p) => p.id)).toEqual([b.id]);
  });
  it('valida data, pose e imagem', async () => {
    await expect(repo.add({ date: '10/10/2026', pose: 'FRONT', image: IMG })).rejects.toThrow(PhotoError);
    await expect(repo.add({ date: '2026-10-10', pose: 'XX' as never, image: IMG })).rejects.toThrow(PhotoError);
    await expect(repo.add({ date: '2026-10-10', pose: 'FRONT', image: 'http://x/y.jpg' })).rejects.toThrow(PhotoError);
    await expect(repo.add({ date: '2026-10-10', pose: 'FRONT', image: 'data:image/jpeg;base64,' + 'A'.repeat(1_500_000) })).rejects.toThrow(/grande/);
  });
});
