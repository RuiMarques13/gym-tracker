import { describe, expect, it } from 'vitest';
import { E1RM_MAX_REPS, estimate1RM, reliable1RM } from './one-rm';

describe('1RM estimado (Epley, rules.ts `e1rm`)', () => {
  it('peso × (1 + repetições / 30)', () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimate1RM(60, 5)).toBeCloseTo(70, 5);
  });
  it('1 repetição = o próprio peso', () => {
    expect(estimate1RM(140, 1)).toBe(140);
  });
  it('sem carga ou sem repetições: null', () => {
    expect(estimate1RM(null, 5)).toBeNull();
    expect(estimate1RM(0, 5)).toBeNull();
    expect(estimate1RM(-10, 5)).toBeNull();
    expect(estimate1RM(60, null)).toBeNull();
    expect(estimate1RM(60, 0)).toBeNull();
  });
});

describe('1RM para decisões (até 10 repetições, contando a reserva)', () => {
  it('soma a reserva às repetições feitas (rules.ts `e1rm.rir`)', () => {
    expect(reliable1RM(100, 6, 2)).toBeCloseTo(estimate1RM(100, 8)!, 5);
  });
  it(`até ${E1RM_MAX_REPS} repetições conta; acima não`, () => {
    expect(reliable1RM(100, E1RM_MAX_REPS)).not.toBeNull();
    expect(reliable1RM(100, E1RM_MAX_REPS + 1)).toBeNull();
    expect(reliable1RM(100, 8, 3)).toBeNull();
  });
  it('sem reserva registada conta só as repetições', () => {
    expect(reliable1RM(100, 5, null)).toBeCloseTo(estimate1RM(100, 5)!, 5);
    expect(reliable1RM(100, null)).toBeNull();
  });
});
