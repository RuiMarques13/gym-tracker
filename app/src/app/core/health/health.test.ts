import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/test-db';
import { SqliteHealthRepository } from '../../data/repositories/health.repository';
import type { HealthProvider } from './health-provider';
import { downsample, summarize } from './health.logic';
import { importSessionHealth } from './health.service';

const t = (s: number) => new Date(Date.UTC(2026, 9, 10, 10, 0, s)).toISOString();

describe('lógica de FC', () => {
  it('junta amostras por janela de 10 s e ignora valores impossíveis', () => {
    const pts = downsample([
      { ts: t(0), bpm: 100 }, { ts: t(4), bpm: 110 }, { ts: t(12), bpm: 120 },
      { ts: t(15), bpm: 0 }, { ts: t(16), bpm: 999 }, { ts: 'x', bpm: 90 },
    ]);
    expect(pts).toEqual([{ ts: t(0), bpm: 105 }, { ts: t(10), bpm: 120 }]);
  });
  it('resume média, máximo e mínimo', () => {
    expect(summarize([{ ts: t(0), bpm: 100 }, { ts: t(10), bpm: 140 }])).toEqual({ avg: 120, max: 140, min: 100, samples: 2 });
    expect(summarize([])).toEqual({ avg: null, max: null, min: null, samples: 0 });
  });
});

function fake(over: Partial<HealthProvider> = {}): HealthProvider {
  return {
    sourceName: 'Teste',
    availability: async () => ({ available: true }),
    hasAccess: async () => true,
    requestAccess: async () => true,
    heartRate: async () => [{ ts: t(0), bpm: 100 }, { ts: t(20), bpm: 140 }],
    activeCalories: async () => 220,
    openSettings: async () => undefined,
    ...over,
  };
}

describe('importar saúde de uma sessão', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let repo: SqliteHealthRepository;
  const session = { id: 's1', startedAt: t(0), endedAt: t(60) };
  beforeEach(async () => {
    db = await createTestDb();
    repo = new SqliteHealthRepository(db.db);
  });

  it('guarda amostras e resumo; importar de novo substitui', async () => {
    const r = await importSessionHealth(fake(), repo, session, t(100));
    expect(r.ok && r.health).toMatchObject({ avg: 120, max: 140, min: 100, samples: 2, caloriesKcal: 220, source: 'Teste' });
    expect(await repo.points('s1')).toHaveLength(2);
    await importSessionHealth(fake({ heartRate: async () => [{ ts: t(0), bpm: 90 }], activeCalories: async () => null }), repo, session, t(200));
    expect(await repo.points('s1')).toEqual([{ ts: t(0), bpm: 90 }]);
    expect((await repo.summary('s1'))?.caloriesKcal).toBeNull();
  });

  it('explica quando não há permissão, disponibilidade ou dados', async () => {
    expect(await importSessionHealth(fake({ availability: async () => ({ available: false, reason: 'sem HC' }) }), repo, session, t(1)))
      .toEqual({ ok: false, reason: 'sem HC' });
    const denied = await importSessionHealth(fake({ hasAccess: async () => false, requestAccess: async () => false }), repo, session, t(1));
    expect(denied.ok).toBe(false);
    const empty = await importSessionHealth(fake({ heartRate: async () => [], activeCalories: async () => null }), repo, session, t(1));
    expect(!empty.ok && empty.reason).toMatch(/ainda não enviou/);
    expect(await repo.summary('s1')).toBeNull();
  });

  it('sessão sem fim usa a hora atual como fim', async () => {
    let seen = '';
    await importSessionHealth(fake({ heartRate: async (_s, e) => { seen = e; return []; }, activeCalories: async () => 10 }), repo, { ...session, endedAt: null }, t(77));
    expect(seen).toBe(t(77));
  });
});
