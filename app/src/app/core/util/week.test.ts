import { describe, expect, it } from 'vitest';
import { addDays, weekDays, weekStartOf } from './week';

describe('week', () => {
  it('semana de segunda a domingo', () => {
    expect(weekStartOf('2026-10-10')).toBe('2026-10-05'); // sábado
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05'); // segunda
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05'); // domingo
    expect(weekDays('2026-10-05')).toHaveLength(7);
    expect(weekDays('2026-10-05')[6]).toBe('2026-10-11');
  });
  it('atravessa meses e mudanças de hora', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
});
