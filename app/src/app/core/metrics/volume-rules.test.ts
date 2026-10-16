import { describe, expect, it } from 'vitest';
import { VOLUME_RULES } from './volume-rules';

/** Coerência interna das faixas de volume (os valores e a sua origem estão em rules.ts, área «volume»). */
describe('faixas de volume', () => {
  const ranges = [
    ...Object.entries(VOLUME_RULES.goals.hypertrophy).map(([k, r]) => [`hypertrophy.${k}`, r] as const),
    ['maintenance.60_plus', VOLUME_RULES.goals.maintenance['60_plus']] as const,
  ];

  it('mínimo ≤ alvo ≤ máximo; frequência e reserva com início ≤ fim', () => {
    for (const [k, r] of ranges) {
      expect(r.min, k).toBeLessThanOrEqual(r.target);
      expect(r.target, k).toBeLessThanOrEqual(r.max);
      expect(r.freq[0], k).toBeLessThanOrEqual(r.freq[1]);
      expect(r.rir[0], k).toBeLessThanOrEqual(r.rir[1]);
    }
  });

  it('o volume e o máximo sobem com o nível; a reserva desce', () => {
    const { beginner: b, intermediate: i, advanced: a } = VOLUME_RULES.goals.hypertrophy;
    expect(b.target).toBeLessThan(i.target);
    expect(i.target).toBeLessThan(a.target);
    expect(b.max).toBeLessThanOrEqual(i.max);
    expect(i.max).toBeLessThanOrEqual(a.max);
    expect(a.rir[1]).toBeLessThanOrEqual(b.rir[1]);
  });

  it('nenhum máximo passa as 20 séries (IUSCA 2021: evidência limitada acima disso)', () => {
    for (const [k, r] of ranges) expect(r.max, k).toBeLessThanOrEqual(20);
    expect(VOLUME_RULES.goals.cut.any.max).toBeLessThanOrEqual(20);
  });

  it('a hipertrofia treina cada músculo pelo menos 2 vezes por semana (ACSM 2026, comunicado)', () => {
    for (const r of Object.values(VOLUME_RULES.goals.hypertrophy)) expect(r.freq[0]).toBeGreaterThanOrEqual(2);
  });

  it('série efetiva, peso das secundárias e redução na definição dentro de limites sensatos', () => {
    const e = VOLUME_RULES.effective_set;
    expect(e.reps_min).toBeLessThan(e.reps_max);
    expect(VOLUME_RULES.indirect_set_weight).toBeGreaterThan(0);
    expect(VOLUME_RULES.indirect_set_weight).toBeLessThanOrEqual(1);
    expect(VOLUME_RULES.goals.cut.any.volume_reduction).toBeGreaterThan(0);
    expect(VOLUME_RULES.goals.cut.any.volume_reduction).toBeLessThan(1);
  });
});
