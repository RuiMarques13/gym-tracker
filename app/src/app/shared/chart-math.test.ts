import { describe, expect, it } from 'vitest';
import { formatNumber, lineDomain, niceScale } from './chart-math';

describe('niceScale', () => {
  it('arredonda o máximo para passos 1, 2, 5', () => {
    expect(niceScale(18)).toEqual({ max: 20, step: 5 });
    expect(niceScale(7)).toEqual({ max: 8, step: 2 });
    expect(niceScale(130)).toEqual({ max: 150, step: 50 });
  });
  it('sem dados dá um eixo válido', () => {
    expect(niceScale(0)).toEqual({ max: 4, step: 1 });
  });
});

describe('lineDomain', () => {
  it('dá folga e não cola os extremos ao limite', () => {
    const d = lineDomain([80, 82]);
    expect(d.min).toBeLessThan(80);
    expect(d.max).toBeGreaterThan(82);
  });
  it('um só valor abre um intervalo', () => {
    expect(lineDomain([75])).toEqual({ min: 74, max: 76 });
  });
});

describe('formatNumber', () => {
  it('inteiros sem decimais, o resto com vírgula', () => {
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(62.5)).toBe('62,5');
  });
});
