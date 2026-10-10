import { describe, expect, it } from 'vitest';
import { adviceFor, formatWait, lastStimuli, restAdvice, Stimulus } from './recovery';
import type { MetricExercise, MetricSet } from './volume';

const H = 3_600_000;
const NOW = new Date('2026-10-10T12:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * H);
const ex = new Map<string, MetricExercise>([
  ['supino', { id: 'supino', primaryMuscles: ['peito'], secondaryMuscles: ['triceps'] }],
]);
const set = (p: Partial<MetricSet>): MetricSet => ({
  exerciseId: 'supino', weightKg: 60, reps: 8, rir: 2, type: 'working', performedAt: ago(10), sessionId: 's1', ...p,
});
const stim = (p: Partial<Stimulus>): Stimulus => ({ muscle: 'peito', sets: 6, avgRir: 2, at: ago(10), ...p });

describe('último estímulo', () => {
  it('usa a sessão mais recente de cada músculo, com séries fracionais e RIR médio', () => {
    const sets = [
      ...Array.from({ length: 4 }, () => set({ sessionId: 'velha', performedAt: ago(100) })),
      ...Array.from({ length: 3 }, () => set({ sessionId: 'nova', performedAt: ago(10), rir: 1 })),
      set({ sessionId: 'nova', performedAt: ago(9), rir: 0 }),
      set({ sessionId: 'nova', performedAt: ago(9), type: 'warmup' }),
    ];
    const r = lastStimuli(sets, ex, NOW);
    const peito = r.find((s) => s.muscle === 'peito')!;
    expect(peito.sets).toBe(4);
    expect(peito.avgRir).toBe(0.75);
    expect(peito.at.getTime()).toBe(ago(9).getTime());
    expect(r.find((s) => s.muscle === 'triceps')!.sets).toBe(2);
  });
  it('ignora séries com mais de 7 dias e séries não efetivas', () => {
    expect(lastStimuli([set({ performedAt: ago(24 * 8) }), set({ reps: 3 })], ex, NOW)).toEqual([]);
  });
});

describe('descanso recomendado', () => {
  it('músculo grande, volume médio: entre 48 e 72 h e ainda a recuperar', () => {
    const a = adviceFor(stim({ sets: 6 }), undefined, NOW);
    expect(a.hoursNeeded).toBe(58);
    expect(a.status).toBe('recovering');
    expect(a.hoursLeft).toBe(48);
  });
  it('músculo pequeno com pouco volume: 24 h; pronto passado o tempo', () => {
    const a = adviceFor(stim({ muscle: 'biceps', sets: 2, at: ago(30) }), undefined, NOW);
    expect(a.hoursNeeded).toBe(24);
    expect(a.status).toBe('ready');
    expect(a.hoursLeft).toBe(0);
  });
  it('perto da falha soma 12 h', () => {
    expect(adviceFor(stim({ sets: 3, avgRir: 0 }), undefined, NOW).hoursNeeded).toBe(60);
  });
  it('a dor ajusta; dor anterior ao treino não conta', () => {
    const base = adviceFor(stim({ sets: 3 }), undefined, NOW).hoursNeeded; // 48
    expect(adviceFor(stim({ sets: 3 }), { muscle: 'peito', date: '2026-10-10', level: 4 }, NOW).hoursNeeded).toBe(base + 24);
    expect(adviceFor(stim({ sets: 3 }), { muscle: 'peito', date: '2026-10-10', level: 1 }, NOW).hoursNeeded).toBe(base - 6);
    expect(adviceFor(stim({ sets: 3 }), { muscle: 'peito', date: '2026-10-01', level: 5 }, NOW).hoursNeeded).toBe(base);
  });
  it('ordena os que mais faltam primeiro e usa a dor mais recente', () => {
    const r = restAdvice(
      [stim({ muscle: 'biceps', sets: 2, at: ago(30) }), stim({ muscle: 'peito', sets: 8 })],
      [{ muscle: 'peito', date: '2026-10-09', level: 5 }, { muscle: 'peito', date: '2026-10-10', level: 2 }],
      NOW,
    );
    expect(r.map((x) => x.muscle)).toEqual(['peito', 'biceps']);
    expect(r[0].reasons.join(' ')).not.toContain('dor');
  });
  it('formata a espera', () => {
    expect(formatWait(0)).toBe('pronto');
    expect(formatWait(14)).toBe('em 14 h');
    expect(formatWait(30)).toBe('em ~1 dia');
    expect(formatWait(60)).toBe('em ~3 dias');
  });
});
