import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/test-db';
import { SqliteHealthRepository } from '../../data/repositories/health.repository';
import type { HealthProvider, WorkoutReading } from './health-provider';
import { chartSeries, deriveCalories, downsample, energyForWorkout, heartRateRecovery, hrMaxTanaka, latestBmr, mifflinBmr, summarize, timeInZones } from './health.logic';
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

const EMPTY: WorkoutReading = { heartRate: [], activeRecords: [], totalRecords: [], basal: [], steps: [], distance: [], vo2Max: null, exercise: null };

function fake(over: Partial<HealthProvider> = {}, reading: Partial<WorkoutReading> = {}): HealthProvider {
  const r: WorkoutReading = {
    ...EMPTY,
    heartRate: [{ ts: t(0), bpm: 100 }, { ts: t(20), bpm: 140 }],
    activeRecords: [{ startDate: t(0), endDate: t(60), value: 220 }],
    ...reading,
  };
  return {
    sourceName: 'Teste',
    availability: async () => ({ available: true }),
    hasAccess: async () => true,
    hasFullAccess: async () => true,
    requestAccess: async () => true,
    heartRate: async () => r.heartRate,
    readWorkout: async () => r,
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
    await importSessionHealth(fake({}, { heartRate: [{ ts: t(0), bpm: 90 }], activeRecords: [] }), repo, session, t(200));
    expect(await repo.points('s1')).toEqual([{ ts: t(0), bpm: 90 }]);
    expect((await repo.summary('s1'))?.caloriesKcal).toBeNull();
  });

  it('explica quando não há permissão, disponibilidade ou dados', async () => {
    expect(await importSessionHealth(fake({ availability: async () => ({ available: false, reason: 'sem HC' }) }), repo, session, t(1)))
      .toEqual({ ok: false, reason: 'sem HC' });
    const denied = await importSessionHealth(fake({ hasAccess: async () => false, requestAccess: async () => false }), repo, session, t(1));
    expect(denied.ok).toBe(false);
    const empty = await importSessionHealth(fake({}, { heartRate: [], activeRecords: [] }), repo, session, t(1));
    expect(!empty.ok && empty.reason).toMatch(/ainda não enviou/);
    expect(await repo.summary('s1')).toBeNull();
  });

  it('sessão sem fim usa a hora atual como fim', async () => {
    let seen = '';
    await importSessionHealth(fake({ readWorkout: async (_s, e) => { seen = e; return { ...EMPTY, activeRecords: [{ startDate: t(0), endDate: t(60), value: 10 }] }; } }), repo, { ...session, endedAt: null }, t(77));
    expect(seen).toBe(t(77));
  });
});

describe('importar como o Samsung escreve', () => {
  it('só total + repouso + passos: deriva as ativas e guarda recuperação, passos e exercício', async () => {
    const db = await createTestDb();
    const repo = new SqliteHealthRepository(db.db);
    const S = t(0), E = t(1800);
    const provider = fake({}, {
      heartRate: [{ ts: t(900), bpm: 150 }, { ts: t(1790), bpm: 168 }, { ts: t(1800), bpm: 170 }, { ts: t(1860), bpm: 140 }, { ts: t(1870), bpm: 142 }],
      activeRecords: [],
      totalRecords: [{ startDate: S, endDate: E, value: 260 }],
      basal: [{ ts: t(-3600), kcalPerDay: 1680 }],
      steps: [{ startDate: S, endDate: E, value: 3000 }],
      distance: [{ startDate: S, endDate: E, value: 2400 }],
      vo2Max: 41.26,
      exercise: { type: 'runningTreadmill', durationSec: 1800, energyKcal: 260, distanceM: 2400, sourceName: 'Samsung Health' },
    });
    const r = await importSessionHealth(provider, repo, { id: 's9', startedAt: S, endedAt: E }, t(2000));
    expect(r.ok && r.health).toMatchObject({
      caloriesTotalKcal: 260, caloriesKcal: 225, caloriesBasalKcal: 35, caloriesBasis: 'watch-total',
      steps: 3000, distanceM: 2400, hrEndBpm: 169, hrRecoveryBpm: 28, vo2max: 41.3,
      exerciseType: 'runningTreadmill', exerciseSeconds: 1800, source: 'Samsung Health',
    });
    // a FC depois do fim guarda-se para o gráfico mas não entra na média do treino
    expect(r.ok && r.health.max).toBe(170);
  });
  it('pede de novo as permissões novas quando faltam, sem falhar se a FC está autorizada', async () => {
    const db = await createTestDb();
    const repo = new SqliteHealthRepository(db.db);
    let asked = 0;
    const r = await importSessionHealth(fake({ hasFullAccess: async () => false, requestAccess: async () => { asked++; return true; } }), repo, { id: 's1', startedAt: t(0), endedAt: t(60) }, t(100));
    expect(asked).toBe(1);
    expect(r.ok).toBe(true);
  });
});

describe('chartSeries', () => {
  it('média por minuto desde o início', () => {
    const r = chartSeries([{ ts: t(0), bpm: 100 }, { ts: t(30), bpm: 120 }, { ts: t(70), bpm: 140 }], t(0));
    expect(r).toEqual([{ minute: 1, bpm: 110 }, { minute: 2, bpm: 140 }]);
  });
  it('limita o número de pontos em treinos longos', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ ts: t(i * 60), bpm: 100 + (i % 20) }));
    expect(chartSeries(many, t(0), 60).length).toBeLessThanOrEqual(60);
    expect(chartSeries([], t(0))).toEqual([]);
  });
});


describe('calorias do relógio', () => {
  const S = t(0), E = t(1800); // 30 min
  it('o Samsung só escreve o total: ativas = total − repouso', () => {
    const r = deriveCalories({ activeRecords: [], totalRecords: [{ startDate: S, endDate: E, value: 200 }], bmrKcalPerDay: 1680, startIso: S, endIso: E });
    // 1680 kcal/dia ⇒ 35 kcal em 30 min
    expect(r).toEqual({ totalKcal: 200, activeKcal: 165, basalKcal: 35, basis: 'watch-total' });
  });
  it('ativas gravadas têm prioridade; o total vem do relógio', () => {
    const r = deriveCalories({ activeRecords: [{ startDate: S, endDate: E, value: 150 }], totalRecords: [{ startDate: S, endDate: E, value: 190 }], bmrKcalPerDay: 1680, startIso: S, endIso: E });
    expect(r).toMatchObject({ totalKcal: 190, activeKcal: 150, basis: 'watch-active' });
  });
  it('sem taxa basal conhecida só dá o total', () => {
    const r = deriveCalories({ activeRecords: [], totalRecords: [{ startDate: S, endDate: E, value: 200 }], bmrKcalPerDay: null, startIso: S, endIso: E });
    expect(r).toEqual({ totalKcal: 200, activeKcal: null, basalKcal: null, basis: null });
  });
  it('sem dados devolve tudo vazio', () => {
    expect(deriveCalories({ activeRecords: [], totalRecords: [], bmrKcalPerDay: 1700, startIso: S, endIso: E })).toEqual({ totalKcal: null, activeKcal: null, basalKcal: null, basis: null });
  });
  it('o total nunca fica abaixo do repouso (ativas ≥ 0)', () => {
    const r = deriveCalories({ activeRecords: [], totalRecords: [{ startDate: S, endDate: E, value: 20 }], bmrKcalPerDay: 1680, startIso: S, endIso: E });
    expect(r).toMatchObject({ activeKcal: 0, basalKcal: 20 });
  });
  it('prefere o registo que encaixa no treino a blocos longos de outras apps', () => {
    const records = [
      { startDate: S, endDate: E, value: 200 },
      { startDate: t(-3600), endDate: t(3600 * 5), value: 3000 }, // bloco de horas: não entra
    ];
    expect(energyForWorkout(records, S, E)).toBe(200);
    // sem registo que encaixe, distribui proporcionalmente
    expect(Math.round(energyForWorkout([{ startDate: t(-1800), endDate: t(1800), value: 100 }], S, E))).toBe(50);
  });
  it('taxa basal: usa a mais recente antes do fim; Mifflin como alternativa', () => {
    expect(latestBmr([{ ts: t(-86400), kcalPerDay: 1600 }, { ts: t(-3600), kcalPerDay: 1700 }, { ts: t(9999), kcalPerDay: 1800 }, { ts: t(-10), kcalPerDay: 5 }], E)).toBe(1700);
    expect(latestBmr([], E)).toBeNull();
    expect(mifflinBmr({ weightKg: 80, heightCm: 180, age: 30, sex: 'M' })).toBe(1780);
    expect(mifflinBmr({ weightKg: 60, heightCm: 165, age: 30, sex: 'F' })).toBe(1320);
    expect(mifflinBmr({ weightKg: null, heightCm: 180, age: 30, sex: 'M' })).toBeNull();
  });
});

describe('recuperação e zonas de FC', () => {
  it('queda de FC ao fim de 1 min', () => {
    const end = t(600);
    const pts = [
      { ts: t(580), bpm: 170 }, { ts: t(590), bpm: 174 }, { ts: t(600), bpm: 172 },
      { ts: t(650), bpm: 150 }, { ts: t(660), bpm: 146 }, { ts: t(670), bpm: 148 },
    ];
    expect(heartRateRecovery(pts, end)).toEqual({ atEnd: 172, after1min: 148, drop: 24 });
    expect(heartRateRecovery(pts.slice(0, 3), end)).toBeNull();
  });
  it('FC máxima (Tanaka)', () => {
    expect(hrMaxTanaka(30)).toBe(187);
    expect(hrMaxTanaka(null)).toBeNull();
  });
  it('segundos por zona, só dentro do treino', () => {
    // FCmáx 200: <100 fora; 100–119 z1; 120–139 z2; 140–159 z3; 160–179 z4; ≥180 z5
    const pts = [
      { ts: t(0), bpm: 90 }, { ts: t(10), bpm: 110 }, { ts: t(20), bpm: 130 }, { ts: t(30), bpm: 150 },
      { ts: t(40), bpm: 170 }, { ts: t(50), bpm: 190 }, { ts: t(70), bpm: 190 },
    ];
    expect(timeInZones(pts, 200, t(0), t(60))).toEqual([10, 10, 10, 10, 10]);
    // buracos grandes só contam 30 s
    expect(timeInZones([{ ts: t(0), bpm: 190 }, { ts: t(500), bpm: 190 }], 200, t(0), t(600))).toEqual([0, 0, 0, 0, 60]);
  });
});
