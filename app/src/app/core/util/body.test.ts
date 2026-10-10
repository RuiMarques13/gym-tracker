import { describe, expect, it } from 'vitest';
import { ageOn, bmi, bmiLabel } from './body';

describe('body', () => {
  it('IMC', () => {
    expect(bmi(80, 180)).toBe(24.7);
    expect(bmi(null, 180)).toBeNull();
    expect(bmi(80, 0)).toBeNull();
    expect(bmiLabel(24.7)).toBe('peso normal');
    expect(bmiLabel(31)).toBe('obesidade');
  });
  it('idade', () => {
    expect(ageOn('1990-10-11', '2026-10-10')).toBe(35);
    expect(ageOn('1990-10-10', '2026-10-10')).toBe(36);
    expect(ageOn('2030-01-01', '2026-10-10')).toBeNull();
    expect(ageOn(null, '2026-10-10')).toBeNull();
    expect(ageOn('lixo', '2026-10-10')).toBeNull();
  });
});
