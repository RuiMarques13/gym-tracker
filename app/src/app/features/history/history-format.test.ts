import { describe, expect, it } from 'vitest';
import { epley, formatSpan, formatVolume } from './history-format';

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
