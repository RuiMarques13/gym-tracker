import { describe, expect, it } from 'vitest';
import type { SetType, Side } from '../../data/models/enums';
import type { SessionSet, SetGroup } from '../../data/models/session';
import { canQuickLog, DEFAULT_WEIGHT_STEP, isComplete, nextSetValues, stepValue, weightStep, type NextSetInput } from './next-set';

const row = (side: Side, p: Partial<SessionSet> = {}): SessionSet => ({
  id: `${side}-${p.position ?? 1}`, position: 1, type: 'WORKING', side, weightKg: 60, reps: 10, durationSeconds: null, distanceM: null,
  caloriesKcal: null, rpe: null, rir: 2, romScore: 3, restSecondsActual: null, completedAt: '2026-10-16T09:00:00.000Z', ...p,
});
const group = (position: number, type: SetType, sets: SessionSet[]): SetGroup => ({ position, type, sets: sets.map((s) => ({ ...s, position, type })) });
const noTargets = { targetWeightKg: null, targetReps: null, targetDurationSeconds: null, targetDistanceM: null };
const input = (p: Partial<NextSetInput>): NextSetInput => ({ sides: ['BOTH'], today: [], previous: [], targets: noTargets, suggestion: null, ...p });

describe('nextSetValues', () => {
  it('repete a última série de trabalho de hoje, sem copiar RIR nem amplitude', () => {
    const r = nextSetValues(input({
      today: [group(1, 'WORKING', [row('BOTH', { weightKg: 60, reps: 10 })]), group(2, 'WORKING', [row('BOTH', { weightKg: 62.5, reps: 8 })])],
    }));
    expect(r).toEqual({ BOTH: { weightKg: 62.5, reps: 8, durationSeconds: null, distanceM: null, caloriesKcal: null } });
  });

  it('um aquecimento depois das séries de trabalho não muda a proposta', () => {
    const r = nextSetValues(input({
      today: [group(1, 'WORKING', [row('BOTH', { weightKg: 60 })]), group(2, 'WARMUP', [row('BOTH', { weightKg: 20 })])],
    }));
    expect(r.BOTH?.weightKg).toBe(60);
  });

  it('só aquecimentos hoje: parte da última sessão, não do aquecimento', () => {
    const r = nextSetValues(input({
      today: [group(1, 'WARMUP', [row('BOTH', { weightKg: 20, reps: 12 })])],
      previous: [group(1, 'WARMUP', [row('BOTH', { weightKg: 30 })]), group(2, 'WORKING', [row('BOTH', { weightKg: 57.5, reps: 9 })])],
    }));
    expect(r.BOTH).toMatchObject({ weightKg: 57.5, reps: 9 });
  });

  it('sem histórico: os alvos do treino; sem alvos: o aquecimento; sem nada: vazio', () => {
    expect(nextSetValues(input({ targets: { ...noTargets, targetWeightKg: 40, targetReps: 12 } })).BOTH).toMatchObject({ weightKg: 40, reps: 12 });
    expect(nextSetValues(input({ today: [group(1, 'WARMUP', [row('BOTH', { weightKg: 20, reps: 15 })])] })).BOTH).toMatchObject({ weightKg: 20, reps: 15 });
    expect(nextSetValues(input({}))).toEqual({});
  });

  it('com sugestão de carga: carga sugerida e o mínimo da faixa', () => {
    const r = nextSetValues(input({
      previous: [group(1, 'WORKING', [row('BOTH', { weightKg: 60, reps: 12 })])],
      suggestion: { weightKg: 62.5, repsMin: 8, action: 'increase' },
    }));
    expect(r.BOTH).toMatchObject({ weightKg: 62.5, reps: 8 });
  });

  it('a manter a carga: ficam as repetições de antes', () => {
    const r = nextSetValues(input({
      previous: [group(1, 'WORKING', [row('BOTH', { weightKg: 60, reps: 10 })])],
      suggestion: { weightKg: 60, repsMin: 8, action: 'hold' },
    }));
    expect(r.BOTH).toMatchObject({ weightKg: 60, reps: 10 });
  });

  it('sugestão sem carga (primeira vez): não inventa números', () => {
    expect(nextSetValues(input({ suggestion: { weightKg: null, repsMin: 8, action: 'start' } }))).toEqual({});
  });

  it('depois da primeira série de hoje a sugestão já não manda: repete o que fizeste', () => {
    const r = nextSetValues(input({
      today: [group(1, 'WORKING', [row('BOTH', { weightKg: 60, reps: 7 })])],
      suggestion: { weightKg: 62.5, repsMin: 8, action: 'increase' },
    }));
    expect(r.BOTH).toMatchObject({ weightKg: 60, reps: 7 });
  });

  it('unilateral: cada lado com os seus valores', () => {
    const r = nextSetValues(input({
      sides: ['LEFT', 'RIGHT'],
      today: [group(1, 'WORKING', [row('LEFT', { weightKg: 20, reps: 10 }), row('RIGHT', { weightKg: 20, reps: 9 })])],
    }));
    expect(r.LEFT?.reps).toBe(10);
    expect(r.RIGHT?.reps).toBe(9);
  });
});

describe('isComplete e canQuickLog', () => {
  const v = (p: object) => ({ weightKg: null, reps: null, durationSeconds: null, distanceM: null, caloriesKcal: null, ...p });
  it('repetições ou duração preenchidas em todos os lados', () => {
    expect(isComplete('WEIGHT_REPS', { BOTH: v({ weightKg: 60, reps: 10 }) }, ['BOTH'])).toBe(true);
    expect(isComplete('REPS', { BOTH: v({ reps: 12 }) }, ['BOTH'])).toBe(true);
    expect(isComplete('WEIGHT_REPS', { BOTH: v({ weightKg: 60 }) }, ['BOTH'])).toBe(false);
    expect(isComplete('DURATION', { BOTH: v({ durationSeconds: 45 }) }, ['BOTH'])).toBe(true);
    expect(isComplete('DURATION', { BOTH: v({ durationSeconds: 0 }) }, ['BOTH'])).toBe(false);
    expect(isComplete('REPS', { LEFT: v({ reps: 10 }) }, ['LEFT', 'RIGHT'])).toBe(false);
  });
  it('exercícios de peso corporal registam-se sem carga', () => {
    expect(isComplete('WEIGHT_REPS', { BOTH: v({ reps: 10 }) }, ['BOTH'])).toBe(true);
  });
  it('cardio nunca é de um toque', () => {
    expect(canQuickLog('CARDIO', 'DURATION', { BOTH: v({ durationSeconds: 600 }) }, ['BOTH'])).toBe(false);
    expect(canQuickLog('STRENGTH', 'WEIGHT_REPS', { BOTH: v({ weightKg: 60, reps: 10 }) }, ['BOTH'])).toBe(true);
    expect(canQuickLog('MOBILITY', 'DURATION', { BOTH: v({ durationSeconds: 30 }) }, ['BOTH'])).toBe(true);
  });
});

describe('steppers', () => {
  it('passo da carga: o incremento do material ou 2,5 kg', () => {
    expect(weightStep(5)).toBe(5);
    expect(weightStep(null)).toBe(DEFAULT_WEIGHT_STEP);
    expect(weightStep(0)).toBe(DEFAULT_WEIGHT_STEP);
  });
  it('soma e subtrai no passo', () => {
    expect(stepValue(60, 2.5)).toBe(62.5);
    expect(stepValue(60, -2.5)).toBe(57.5);
    expect(stepValue(10, 1)).toBe(11);
    expect(stepValue(10, -1, 1)).toBe(9);
  });
  it('fora do passo, encaixa no múltiplo seguinte', () => {
    expect(stepValue(61, 2.5)).toBe(62.5);
    expect(stepValue(61, -2.5)).toBe(60);
    expect(stepValue(22.75, 2)).toBe(24);
  });
  it('nunca abaixo do mínimo; sem valor começa no passo ou no mínimo', () => {
    expect(stepValue(0, -2.5)).toBe(0);
    expect(stepValue(1, -1, 1)).toBe(1);
    expect(stepValue(null, 2.5)).toBe(2.5);
    expect(stepValue(null, 1, 1)).toBe(1);
    expect(stepValue(null, -1, 1)).toBe(1);
  });
  it('sem erros de vírgula flutuante', () => {
    let x = 0;
    for (let i = 0; i < 10; i++) x = stepValue(x, 0.1);
    expect(x).toBe(1);
  });
});
