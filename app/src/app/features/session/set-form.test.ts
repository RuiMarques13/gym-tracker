import { describe, expect, it } from 'vitest';
import type { SessionSet } from '../../data/models/session';
import { collapsedSummary, quickLabel } from './session-format';
import { EMPTY_FORM, entriesOf, entriesOfNext, entriesWithRir, formOf, formOfSet, formsOfNext, toNum } from './set-form';

const v = (p: object) => ({ weightKg: null, reps: null, durationSeconds: null, distanceM: null, caloriesKcal: null, ...p });
const set = (p: Partial<SessionSet>): SessionSet => ({
  id: 'x', position: 3, type: 'WORKING', side: 'BOTH', weightKg: 60, reps: 10, durationSeconds: null, distanceM: null,
  caloriesKcal: null, rpe: null, rir: null, romScore: null, restSecondsActual: 90, completedAt: '2026-10-16T09:00:00.000Z', ...p,
});

describe('campos da folha de série', () => {
  it('aceita vírgula decimal e vazio', () => {
    expect(toNum('62,5')).toBe(62.5);
    expect(toNum(' ')).toBeNull();
    expect(toNum('abc')).toBeNull();
  });
  it('cardio em minutos e km; resto em segundos', () => {
    expect(formOf('CARDIO', v({ durationSeconds: 1500, distanceM: 5200 }))).toMatchObject({ duration: '25', distance: '5.2' });
    expect(formOf('MOBILITY', v({ durationSeconds: 45 }))).toMatchObject({ duration: '45' });
  });
  it('uma série guardada traz a reserva e a amplitude; a proposta não', () => {
    expect(formOfSet('STRENGTH', set({ rir: 2, romScore: 4 }))).toMatchObject({ rir: 2, rom: 4 });
    expect(formsOfNext('STRENGTH', { BOTH: v({ weightKg: 60, reps: 10 }) }, ['BOTH']).BOTH).toMatchObject({ weight: '60', reps: '10', rir: null, rom: null });
    expect(formsOfNext('STRENGTH', {}, ['LEFT', 'RIGHT'])).toEqual({ LEFT: EMPTY_FORM, RIGHT: EMPTY_FORM });
  });
});

describe('entradas para gravar', () => {
  it('força: a reserva só nas séries de trabalho', () => {
    const sides = { BOTH: { ...EMPTY_FORM, weight: '60', reps: '10', rir: 2 } };
    expect(entriesOf('STRENGTH', 'WEIGHT_REPS', { type: 'WORKING', sides }, ['BOTH'])[0]).toMatchObject({ weightKg: 60, reps: 10, rir: 2 });
    expect(entriesOf('STRENGTH', 'WEIGHT_REPS', { type: 'WARMUP', sides }, ['BOTH'])[0].rir).toBeNull();
  });
  it('unilateral: o lado vazio fica de fora', () => {
    const sides = { LEFT: { ...EMPTY_FORM, reps: '10' }, RIGHT: { ...EMPTY_FORM } };
    expect(entriesOf('STRENGTH', 'REPS', { type: 'WORKING', sides }, ['LEFT', 'RIGHT']).map((e) => e.side)).toEqual(['LEFT']);
  });
  it('cardio: minutos → segundos, km → metros', () => {
    const sides = { BOTH: { ...EMPTY_FORM, duration: '25', distance: '5,2' } };
    expect(entriesOf('CARDIO', 'DURATION', { type: 'WORKING', sides }, ['BOTH'])[0]).toMatchObject({ durationSeconds: 1500, distanceM: 5200 });
  });
  it('registo de um toque: os valores propostos, sem reserva', () => {
    expect(entriesOfNext({ BOTH: v({ weightKg: 60, reps: 10 }) }, ['BOTH'])).toEqual([
      { side: 'BOTH', weightKg: 60, reps: 10, durationSeconds: null, distanceM: null, caloriesKcal: null, romScore: null, rir: null },
    ]);
  });
  it('responder à reserva mantém os outros valores', () => {
    const e = entriesWithRir({ position: 3, type: 'WORKING', sets: [set({ side: 'LEFT', weightKg: 20 }), set({ side: 'RIGHT', weightKg: 20, reps: 9 })] }, 1);
    expect(e).toEqual([
      expect.objectContaining({ side: 'LEFT', weightKg: 20, reps: 10, rir: 1 }),
      expect.objectContaining({ side: 'RIGHT', weightKg: 20, reps: 9, rir: 1 }),
    ]);
  });
});

describe('quickLabel', () => {
  it('bilateral, peso corporal e duração', () => {
    expect(quickLabel('STRENGTH', 'WEIGHT_REPS', { BOTH: v({ weightKg: 62.5, reps: 8 }) }, ['BOTH'])).toBe('62,5 kg × 8');
    expect(quickLabel('STRENGTH', 'WEIGHT_REPS', { BOTH: v({ reps: 12 }) }, ['BOTH'])).toBe('12 reps');
    expect(quickLabel('MOBILITY', 'DURATION', { BOTH: v({ durationSeconds: 45 }) }, ['BOTH'])).toBe('45 s');
  });
  it('unilateral igual ou diferente', () => {
    const same = { LEFT: v({ weightKg: 20, reps: 10 }), RIGHT: v({ weightKg: 20, reps: 10 }) };
    expect(quickLabel('STRENGTH', 'WEIGHT_REPS', same, ['LEFT', 'RIGHT'])).toBe('20 kg × 10 cada lado');
    const diff = { LEFT: v({ weightKg: 20, reps: 10 }), RIGHT: v({ weightKg: 20, reps: 9 }) };
    expect(quickLabel('STRENGTH', 'WEIGHT_REPS', diff, ['LEFT', 'RIGHT'])).toBe('Esq 20 kg × 10 · Dir 20 kg × 9');
  });
});

describe('collapsedSummary', () => {
  const strength = { kind: 'STRENGTH', metricType: 'WEIGHT_REPS' } as const;
  it('sem séries: o alvo', () => {
    expect(collapsedSummary({ ...strength, sets: [] }, 3, '3 × 8–12')).toBe('3 × 8–12');
  });
  it('com séries: quantas de quantas e a última de trabalho', () => {
    const sets = [set({ position: 1, weightKg: 60, reps: 10 }), set({ position: 2, weightKg: 62.5, reps: 8 }), set({ position: 3, type: 'WARMUP', weightKg: 20 })];
    expect(collapsedSummary({ ...strength, sets }, 3, '')).toBe('2 de 3 séries · 62,5 kg × 8');
    expect(collapsedSummary({ ...strength, sets: sets.slice(0, 1) }, 0, '')).toBe('1 série · 60 kg × 10');
  });
});
