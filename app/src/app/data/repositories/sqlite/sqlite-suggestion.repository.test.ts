import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { SqliteSuggestionRepository } from '../suggestion.repository';

let repo: SqliteSuggestionRepository;
let clock: FixedClock;

beforeEach(async () => {
  const t = await createTestDb();
  clock = new FixedClock(new Date('2026-10-15T08:00:00.000Z'));
  repo = new SqliteSuggestionRepository(t.db, clock, t.deviceId);
});

describe('histórico de sugestões', () => {
  it('guarda, substitui a mesma resposta e lê desde uma data', async () => {
    const base = { kind: 'STAGNATION' as const, exerciseId: '00000000-0000-5000-8000-000000000001', episode: 's1', response: 'volume' as const };
    await repo.record({ ...base, status: 'DECLINED', payload: null });
    clock.advance(60000);
    await repo.record({ ...base, status: 'ACCEPTED', payload: { extra: 2 } });
    await repo.record({ ...base, response: 'range', status: 'ACCEPTED', payload: { to: [5, 8] } });
    const all = await repo.since('2026-10-01T00:00:00.000Z');
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.response === 'volume')).toMatchObject({ status: 'ACCEPTED', payload: { extra: 2 } });
    expect(await repo.since('2026-10-16T00:00:00.000Z')).toEqual([]);
  });
});
