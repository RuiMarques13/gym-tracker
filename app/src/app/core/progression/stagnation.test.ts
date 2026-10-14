import { describe, expect, it } from 'vitest';
import { fatigueSignals } from './fatigue';
import { suggestLoad } from './load';
import { nextTimeText } from './next-time';
import { RULE, RULES } from './rules';
import { detectStagnation, nextResponse, rangeOptions, volumePlan, type StagSession } from './stagnation';

const ses = (id: string, sets: [number, number, number?][]): StagSession => ({
  id, at: id, sets: sets.map(([w, r, rir]) => ({ weightKg: w, reps: r, rir: rir ?? null })),
});
/** Da mais antiga para a mais recente (os testes leem melhor assim); a função recebe ao contrário. */
const hist = (...s: StagSession[]) => [...s].reverse();

describe('detectStagnation', () => {
  it('3 sessões sem subir carga, repetições nem 1RM: estagnado', () => {
    const r = detectStagnation(hist(
      ses('a', [[60, 10], [60, 10], [60, 9]]),
      ses('b', [[60, 10], [60, 9], [60, 9]]),
      ses('c', [[60, 9], [60, 9], [60, 8]]),
      ses('d', [[60, 10], [60, 9], [60, 8]]),
    ));
    expect(r).toEqual({ stagnated: true, sessionsWithout: 3, episode: 'a' });
  });
  it('mais repetições na mesma carga conta como progresso', () => {
    const r = detectStagnation(hist(
      ses('a', [[60, 10], [60, 10]]), ses('b', [[60, 10], [60, 10]]), ses('c', [[60, 11], [60, 10]]), ses('d', [[60, 10], [60, 10]]),
    ));
    expect(r.stagnated).toBe(false);
    expect(r.episode).toBe('c');
  });
  it('mais carga conta como progresso', () => {
    expect(detectStagnation(hist(
      ses('a', [[60, 10], [60, 10]]), ses('b', [[60, 10], [60, 10]]), ses('c', [[60, 10], [60, 10]]), ses('d', [[62.5, 8], [62.5, 8]]),
    )).stagnated).toBe(false);
  });
  it('sessões com menos de 2 séries de trabalho não contam', () => {
    expect(detectStagnation(hist(
      ses('a', [[60, 10], [60, 10]]), ses('b', [[60, 10]]), ses('c', [[60, 10], [60, 10]]), ses('d', [[60, 10], [60, 10]]),
    )).stagnated).toBe(false);
  });
  it('limiar editável', () => {
    const h = hist(ses('a', [[60, 10], [60, 10]]), ses('b', [[60, 10], [60, 10]]), ses('c', [[60, 10], [60, 10]]));
    expect(detectStagnation(h, 2).stagnated).toBe(true);
    expect(detectStagnation(h, 3).stagnated).toBe(false);
  });
});

describe('respostas', () => {
  it('ordem: descarga com fadiga, depois volume, faixa, troca', () => {
    expect(nextResponse({ fatigue: true, weeklySets: 10, maxSets: 20, done: [] })).toBe('deload');
    expect(nextResponse({ fatigue: true, weeklySets: 10, maxSets: 20, done: ['deload'] })).toBe('volume');
    expect(nextResponse({ fatigue: false, weeklySets: 10, maxSets: 20, done: [] })).toBe('volume');
    expect(nextResponse({ fatigue: false, weeklySets: 20, maxSets: 20, done: [] })).toBe('range');
    expect(nextResponse({ fatigue: false, weeklySets: 10, maxSets: 20, done: ['volume'] })).toBe('range');
    expect(nextResponse({ fatigue: false, weeklySets: 10, maxSets: 20, done: ['volume', 'range'] })).toBe('swap');
  });
  it('volume: +20%, pelo menos +1, até ao máximo', () => {
    expect(volumePlan(10, 20)).toEqual({ from: 10, to: 12, extra: 2 });
    expect(volumePlan(3, 20)).toEqual({ from: 3, to: 4, extra: 1 });
    expect(volumePlan(19, 20)).toEqual({ from: 19, to: 20, extra: 1 });
  });
  it('faixas alternativas', () => {
    expect(rangeOptions(8, 12)).toEqual([[5, 8], [12, 20]]);
    expect(rangeOptions(10, 12)).toEqual([[5, 8], [12, 20]]);
    expect(rangeOptions(5, 8)).toEqual([[8, 12], [12, 20]]);
  });
});

describe('fadiga', () => {
  const base = { rpes: [], rirBySession: [], levelRirMin: 1, soreness: [], perfTrend: [] };
  it('sem sinais', () => expect(fatigueSignals(base)).toEqual([]));
  it('esforço 9+ em 2 das últimas 3', () => {
    expect(fatigueSignals({ ...base, rpes: [9, 7, 10, 10] }).map((s) => s.key)).toEqual(['rpe']);
    expect(fatigueSignals({ ...base, rpes: [9, 7, 8, 10] })).toEqual([]);
  });
  it('RIR 0 na maioria quando o nível pede 1+', () => {
    const rir = [[0, 0, 0], [0, 1, 2]];
    expect(fatigueSignals({ ...base, rirBySession: rir }).map((s) => s.key)).toEqual(['rir']);
    expect(fatigueSignals({ ...base, rirBySession: rir, levelRirMin: 0 })).toEqual([]);
  });
  it('dor forte e desempenho a cair', () => {
    const r = fatigueSignals({ ...base, soreness: [{ muscle: 'peito', level: 4 }], perfTrend: [0.01, -0.03, -0.025] });
    expect(r.map((s) => s.key)).toEqual(['soreness', 'performance']);
  });
});

describe('regras e Porquê?', () => {
  it('chaves únicas; regras com fonte têm ligação', () => {
    expect(new Set(RULES.map((r) => r.key)).size).toBe(RULES.length);
    for (const r of RULES) if (r.mark === 'source') expect(r.refs.length, r.key).toBeGreaterThan(0);
  });
  it('cada sugestão de carga aponta para uma regra que existe', () => {
    const cases = [
      suggestLoad({ history: [], repsMin: 8, repsMax: 12, mechanic: null, incrementKg: 2.5 }),
      suggestLoad({ history: [{ sets: [{ weightKg: 60, reps: 12, rir: 1 }] }, { sets: [{ weightKg: 60, reps: 12, rir: 1 }] }], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2.5 }),
      suggestLoad({ history: [{ sets: [{ weightKg: 60, reps: 9, rir: 1 }] }], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2.5 }),
      suggestLoad({ history: [{ sets: [{ weightKg: 8, reps: 12, rir: 1 }] }, { sets: [{ weightKg: 8, reps: 12, rir: 1 }] }], repsMin: 8, repsMax: 12, mechanic: 'ISOLATION', incrementKg: 2 }),
      suggestLoad({ history: [{ sets: [{ weightKg: 60, reps: 6, rir: 1 }] }, { sets: [{ weightKg: 60, reps: 6, rir: 1 }] }], repsMin: 8, repsMax: 12, mechanic: null, incrementKg: 2.5 }),
    ];
    for (const c of cases) expect(RULE[c.rule], c.rule).toBeTruthy();
  });
  it('Próxima vez: o exemplo do supino', () => {
    const sg = suggestLoad({ history: [{ sets: [{ weightKg: 60, reps: 12, rir: 1 }, { weightKg: 60, reps: 12, rir: 1 }] }, { sets: [{ weightKg: 60, reps: 12, rir: 1 }] }], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2.5 });
    expect(nextTimeText(sg, (x) => `${x} kg`)).toBe('Sobe para 62.5 kg × 8–12.');
  });
});
