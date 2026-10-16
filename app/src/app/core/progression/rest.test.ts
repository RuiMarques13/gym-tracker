import { describe, expect, it } from 'vitest';
import { RULE } from './rules';
import { defaultRest, REST_BY_MECHANIC } from './rest';

describe('descanso por defeito (rules.ts `rest.byMechanic`, `goal.*.rest`)', () => {
  it('hipertrofia: 2 min nos multiarticulares, 90 s nos monoarticulares', () => {
    expect(defaultRest('COMPOUND', true, 75)).toBe(120);
    expect(defaultRest('ISOLATION', true, 75)).toBe(90);
    expect(REST_BY_MECHANIC).toEqual({ COMPOUND: 120, ISOLATION: 90 });
  });
  it('força e potência: 3 min nos multiarticulares', () => {
    expect(defaultRest('COMPOUND', true, 75, 'strength')).toBe(180);
    expect(defaultRest('COMPOUND', true, 75, 'power')).toBe(180);
    expect(defaultRest('ISOLATION', true, 75, 'strength')).toBe(90);
  });
  it('resistência muscular: 60 s em tudo', () => {
    expect(defaultRest('COMPOUND', true, 75, 'endurance')).toBe(60);
    expect(defaultRest('ISOLATION', true, 75, 'endurance')).toBe(60);
  });
  it('desligado, ou sem tipo de exercício: o descanso global', () => {
    expect(defaultRest('COMPOUND', false, 75)).toBe(75);
    expect(defaultRest(null, true, 75)).toBe(75);
  });
  it('os valores aparecem no texto das regras', () => {
    expect(RULE['rest.byMechanic'].value).toContain('2 min');
    expect(RULE['rest.byMechanic'].value).toContain('90 s');
    expect(RULE['goal.strength.rest'].value).toContain('3 min');
    expect(RULE['goal.endurance.rest'].value).toContain('60 s');
  });
});
