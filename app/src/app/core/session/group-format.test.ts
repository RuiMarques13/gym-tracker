import { describe, expect, it } from 'vitest';
import { GROUP_DEFAULTS, groupLabel, isTimed, normalizeConfig, phaseAt, planSeconds, roundsDone, timedPlan } from './group-format';

describe('configuração dos grupos', () => {
  it('Tabata por defeito: 20 s / 10 s × 8', () => {
    expect(GROUP_DEFAULTS.TABATA).toMatchObject({ workSeconds: 20, restSeconds: 10, rounds: 8 });
    expect(groupLabel(GROUP_DEFAULTS.TABATA)).toBe('Tabata · 20 s / 10 s × 8');
  });

  it('rótulos dos outros formatos', () => {
    expect(groupLabel(GROUP_DEFAULTS.CIRCUIT)).toBe('Circuito · 3 voltas · 90 s entre voltas');
    expect(groupLabel(GROUP_DEFAULTS.EMOM)).toBe('EMOM · 10 min');
    expect(groupLabel(GROUP_DEFAULTS.AMRAP)).toBe('AMRAP · 12 min');
    expect(groupLabel(normalizeConfig({ kind: 'INTERVALS', workSeconds: 90, restSeconds: 30, rounds: 5 }))).toBe('Intervalos · 90 s / 30 s × 5');
    expect(groupLabel(GROUP_DEFAULTS.SUPERSET)).toBe('Superset');
    expect(groupLabel(normalizeConfig({ kind: 'INTERVALS', workSeconds: 5, restSeconds: 0, rounds: 1 }))).toBe('Intervalos · 5 s / 0 s × 1');
    expect(groupLabel(normalizeConfig({ kind: 'AMRAP', durationSeconds: 150 }))).toBe('AMRAP · 2:30');
  });

  it('normaliza: só os campos do formato, dentro dos limites', () => {
    const c = normalizeConfig({ kind: 'TABATA', rounds: 500, workSeconds: 1, restSeconds: null, durationSeconds: 99 });
    expect(c).toEqual({ kind: 'TABATA', rounds: 50, roundRestSeconds: null, workSeconds: 5, restSeconds: 10, durationSeconds: null });
    expect(normalizeConfig({ kind: 'EMOM', workSeconds: 30 }).workSeconds).toBe(60);
    expect(normalizeConfig({ kind: 'SUPERSET', rounds: 3 }).rounds).toBeNull();
  });

  it('formatos por tempo', () => {
    expect(isTimed('TABATA')).toBe(true);
    expect(isTimed('CIRCUIT')).toBe(false);
    expect(isTimed(null)).toBe(false);
  });
});

describe('plano do temporizador', () => {
  it('Tabata com 2 exercícios: 8 trabalhos, 7 descansos, 4 min menos o último descanso', () => {
    const p = timedPlan(GROUP_DEFAULTS.TABATA, 2);
    expect(p.filter((x) => x.kind === 'work')).toHaveLength(8);
    expect(p.filter((x) => x.kind === 'rest')).toHaveLength(7);
    expect(planSeconds(p)).toBe(8 * 20 + 7 * 10);
    expect(p.filter((x) => x.kind === 'work').map((x) => x.exercise)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(p[1]).toMatchObject({ kind: 'rest', exercise: 1, round: 1 }); // o descanso mostra o que vem a seguir
  });

  it('EMOM: um minuto por ronda', () => {
    const p = timedPlan({ ...GROUP_DEFAULTS.EMOM, rounds: 3 }, 1);
    expect(p.map((x) => x.start)).toEqual([0, 60, 120]);
    expect(p.every((x) => x.exercise === -1)).toBe(true);
  });

  it('AMRAP: uma fase', () => {
    expect(timedPlan(GROUP_DEFAULTS.AMRAP, 3)).toEqual([{ kind: 'work', start: 0, seconds: 720, round: 1, exercise: -1 }]);
  });

  it('superset e circuito não têm temporizador', () => {
    expect(timedPlan(GROUP_DEFAULTS.CIRCUIT, 3)).toEqual([]);
  });

  it('fase atual e segundos que faltam', () => {
    const p = timedPlan(GROUP_DEFAULTS.TABATA, 1);
    expect(phaseAt(p, 0)).toEqual({ index: 0, remaining: 20, done: false });
    expect(phaseAt(p, 19.2)).toEqual({ index: 0, remaining: 1, done: false });
    expect(phaseAt(p, 20)).toEqual({ index: 1, remaining: 10, done: false });
    expect(phaseAt(p, 30)).toMatchObject({ index: 2, remaining: 20 });
    expect(phaseAt(p, 1000).done).toBe(true);
  });

  it('rondas completas', () => {
    const p = timedPlan(GROUP_DEFAULTS.TABATA, 1);
    expect(roundsDone(p, 0)).toBe(0);
    expect(roundsDone(p, 25)).toBe(1);
    expect(roundsDone(p, 1000)).toBe(8);
  });
});
