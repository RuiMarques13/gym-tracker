import { describe, expect, it } from 'vitest';
import { epley, formatSpan, formatVolume, progressSeries } from './history-format';

describe('history-format', () => {
  it('duração', () => {
    expect(formatSpan('2026-10-10T08:00:00Z', '2026-10-10T08:45:00Z')).toBe('45 min');
    expect(formatSpan('2026-10-10T08:00:00Z', '2026-10-10T09:05:00Z')).toBe('1 h 05');
  });
  it('volume', () => {
    expect(formatVolume(3240.4)).toMatch(/^3\s?240 kg$/);
  });
  it('Epley só para séries de trabalho com carga', () => {
    expect(epley({ weightKg: 100, reps: 5, type: 'WORKING' })).toBe(116.7);
    expect(epley({ weightKg: 100, reps: 1, type: 'WORKING' })).toBe(100);
    expect(epley({ weightKg: 100, reps: 5, type: 'WARMUP' })).toBeNull();
    expect(epley({ weightKg: null, reps: 12, type: 'WORKING' })).toBeNull();
  });
});

describe('progressSeries', () => {
  const set = (weightKg: number, reps: number, type: 'WORKING' | 'WARMUP' = 'WORKING') => ({ weightKg, reps, type }) as never;
  const entry = (startedAt: string, sets: unknown[]) => ({ startedAt, sets }) as never;
  it('ordena por data e ignora aquecimento e sessões sem carga', () => {
    const r = progressSeries([
      entry('2026-10-08T10:00:00Z', [set(60, 5), set(60, 5), set(20, 10, 'WARMUP')]),
      entry('2026-10-01T10:00:00Z', [set(50, 10)]),
      entry('2026-10-05T10:00:00Z', [set(0, 10)]),
    ]);
    expect(r.map((x) => x.at.slice(0, 10))).toEqual(['2026-10-01', '2026-10-08']);
    expect(r[1]).toMatchObject({ volume: 600, topWeight: 60 });
    expect(r[1].e1rm).toBe(70);
  });
});
