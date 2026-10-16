import { describe, expect, it } from 'vitest';
import type { MetricExercise, MetricSet } from '../metrics/volume';
import type { StagSession } from './stagnation';
import {
  countAfter, goalVolumeLimits, mainExerciseIds, pickStagnationCards, recentExerciseIds, recentSessionsRir, sessionsOf,
  stagnationDecision, SUGGEST, weeklySetsByMuscle, type PastResponse,
} from './suggestions';

const NOW = new Date('2026-10-16T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const set = (p: Partial<MetricSet>): MetricSet => ({
  exerciseId: 'supino', weightKg: 60, reps: 10, rir: 2, type: 'working', performedAt: day(1), sessionId: 's1', ...p,
});
const ex = new Map<string, MetricExercise>([
  ['supino', { id: 'supino', primaryMuscles: ['peito'], secondaryMuscles: ['triceps'] }],
  ['agach', { id: 'agach', primaryMuscles: ['quadriceps'], secondaryMuscles: [] }],
]);

/** Quatro sessões iguais, da mais antiga (a) à mais recente (d): estagnado desde «a» com o limiar 3. */
const stalled = (): StagSession[] =>
  ['a', 'b', 'c', 'd']
    .map((id, i) => ({ id, at: `2026-10-0${i + 1}T10:00:00.000Z`, sets: [{ weightKg: 60, reps: 10, rir: 2 }, { weightKg: 60, reps: 10, rir: 2 }] }))
    .reverse();

const resp = (p: Partial<PastResponse>): PastResponse => ({
  kind: 'STAGNATION', exerciseId: 'supino', episode: 'a', response: 'volume', status: 'ACCEPTED', createdAt: '2026-10-05T00:00:00.000Z', ...p,
});
const decide = (p: Partial<Parameters<typeof stagnationDecision>[0]> = {}) =>
  stagnationDecision({ sessions: stalled(), threshold: 3, responses: [], fatigue: false, weeklySets: 10, maxSets: 20, ...p });

describe('sessionsOf', () => {
  it('agrupa por sessão, só séries de trabalho, da mais recente para a mais antiga', () => {
    const r = sessionsOf([
      set({ sessionId: 's1', performedAt: day(3) }), set({ sessionId: 's1', performedAt: day(3), type: 'warmup' }),
      set({ sessionId: 's2', performedAt: day(1) }), set({ sessionId: 's2', performedAt: day(1) }),
      set({ sessionId: 's3', exerciseId: 'agach' }),
    ], 'supino');
    expect(r.map((s) => [s.id, s.sets.length])).toEqual([['s2', 2], ['s1', 1]]);
  });
});

describe('countAfter', () => {
  it('só conta sessões com 2 ou mais séries depois da data', () => {
    const s = stalled();
    expect(countAfter(s, '2026-10-02T00:00:00.000Z')).toBe(3);
    s[0].sets = s[0].sets.slice(0, 1);
    expect(countAfter(s, '2026-10-02T00:00:00.000Z')).toBe(2);
  });
});

describe('recentExerciseIds', () => {
  it(`só os exercícios dos últimos ${SUGGEST.recentDays} dias, sem repetir`, () => {
    const r = recentExerciseIds([set({}), set({}), set({ exerciseId: 'agach', performedAt: day(SUGGEST.recentDays + 1) })], NOW);
    expect(r).toEqual(['supino']);
  });
});

describe('weeklySetsByMuscle', () => {
  it('usa a maior entre a última semana e a média de 4 semanas', () => {
    // 12 séries de supino há 2 semanas, 2 esta semana: média de 4 semanas = 3, última = 2 → conta 3
    const sets = [
      ...Array.from({ length: 12 }, () => set({ performedAt: day(10), sessionId: 'old' })),
      ...Array.from({ length: 2 }, () => set({ performedAt: day(1) })),
    ];
    const v = weeklySetsByMuscle(sets, ex, NOW);
    expect(v.get('peito')).toBeGreaterThan(2);
    // e uma semana forte não é diluída pela média
    const strong = Array.from({ length: 16 }, () => set({ performedAt: day(1) }));
    expect(weeklySetsByMuscle(strong, ex, NOW).get('peito')).toBe(16);
  });
});

describe('goalVolumeLimits', () => {
  it('hipertrofia e força usam o máximo do nível; definição e manutenção os seus', () => {
    expect(goalVolumeLimits('hypertrophy', 'advanced')).toEqual({ maxSets: 20, rirMin: 0 });
    expect(goalVolumeLimits('strength', 'beginner')).toEqual({ maxSets: 12, rirMin: 2 });
    expect(goalVolumeLimits('cut', 'advanced')).toEqual({ maxSets: 20, rirMin: 1 });
    expect(goalVolumeLimits('maintenance', 'intermediate')).toEqual({ maxSets: 8, rirMin: 1 });
  });
});

describe('mainExerciseIds e recentSessionsRir', () => {
  it('principais = os com mais séries de trabalho', () => {
    const sets = [set({}), set({}), set({ exerciseId: 'agach' })];
    expect(mainExerciseIds(sets, 1)).toEqual(['supino']);
  });
  it('RIR das 2 sessões mais recentes, mais recente primeiro', () => {
    const sets = [
      set({ sessionId: 'old', performedAt: day(5), rir: 3 }),
      set({ sessionId: 'mid', performedAt: day(3), rir: 1 }),
      set({ sessionId: 'new', performedAt: day(1), rir: 0 }), set({ sessionId: 'new', performedAt: day(1), rir: null }),
    ];
    expect(recentSessionsRir(sets)).toEqual([[0, null], [1]]);
  });
});

describe('stagnationDecision', () => {
  it('sem estagnação: nada', () => {
    expect(decide({ sessions: stalled().slice(0, 2) })).toBeNull();
  });
  it('estagnado sem fadiga e abaixo do máximo: mais volume', () => {
    expect(decide()).toEqual({ episode: 'a', response: 'volume', sessionsWithout: 3 });
  });
  it('com fadiga: descarga primeiro', () => {
    expect(decide({ fatigue: true })?.response).toBe('deload');
  });
  it('no máximo de volume: outra faixa', () => {
    expect(decide({ weeklySets: 20 })?.response).toBe('range');
  });
  it('depois de aceitar, espera por N sessões sem progresso', () => {
    // aceite a 2 de outubro: só 2 sessões válidas depois (3 e 4) → ainda não
    expect(decide({ responses: [resp({ createdAt: '2026-10-02T12:00:00.000Z' })] })).toBeNull();
    // aceite antes de todas: 3 sessões depois → próxima resposta (volume já feito → faixa)
    expect(decide({ responses: [resp({ createdAt: '2026-09-30T00:00:00.000Z' })] })?.response).toBe('range');
  });
  it('recusar esconde essa resposta neste episódio, mas não noutro', () => {
    expect(decide({ responses: [resp({ status: 'DECLINED' })] })).toBeNull();
    expect(decide({ responses: [resp({ status: 'DECLINED', episode: 'outro' })] })?.response).toBe('volume');
  });
  it('cartões de fadiga não contam como resposta de estagnação', () => {
    expect(decide({ responses: [resp({ kind: 'FATIGUE', status: 'DECLINED' })] })?.response).toBe('volume');
  });
});

describe('pickStagnationCards', () => {
  const cards = [1, 5, 3, 4].map((n) => ({ id: `e${n}`, sessionsWithout: n }));
  it(`na Home: os ${SUGGEST.homeMax} parados há mais tempo`, () => {
    expect(pickStagnationCards(cards, true).map((c) => c.id)).toEqual(['e5', 'e4', 'e3']);
  });
  it('no fim da sessão: todos, ordenados', () => {
    expect(pickStagnationCards(cards, false).map((c) => c.id)).toEqual(['e5', 'e4', 'e3', 'e1']);
  });
});
