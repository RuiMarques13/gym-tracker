import { describe, expect, it } from 'vitest';
import { RULE } from '../progression/rules';
import { lastStimuli } from './recovery';
import { INDIRECT_OVERRIDES, muscleWeights, overrideFor } from './indirect';
import { weeklyVolume, type MetricExercise, type MetricSet } from './volume';
import { rulesWithSecondaryWeight, VOLUME_RULES } from './volume-rules';

const squat = (name: string): MetricExercise => ({
  id: name, name, primaryMuscles: ['quadriceps', 'gluteos'], secondaryMuscles: ['adutores', 'isquiotibiais', 'lombares'],
});
const bench: MetricExercise = { id: 'bench', name: 'Barbell Bench Press', primaryMuscles: ['peito'], secondaryMuscles: ['triceps', 'deltoide_anterior'] };

describe('peso de cada músculo numa série', () => {
  it('principal 1, secundário 0,5 por defeito (tríceps no supino)', () => {
    expect(Object.fromEntries(muscleWeights(bench, 0.5))).toEqual({ peito: 1, triceps: 0.5, deltoide_anterior: 0.5 });
  });

  it('o peso dos secundários segue a definição', () => {
    expect(muscleWeights(bench, 0.25).get('triceps')).toBe(0.25);
    expect(muscleWeights(bench, 0).has('triceps')).toBe(false);
  });

  it('agachamentos bilaterais: isquiotibiais 0, o resto como sempre', () => {
    for (const name of ['Barbell Back Squat', 'Barbell Front Squat', 'Dumbbell Goblet Squat', 'Box Squat', 'Smith Machine Squat', 'Bodyweight Squat', 'Agachamento traseiro']) {
      const w = muscleWeights(squat(name), 0.5);
      expect(w.has('isquiotibiais'), name).toBe(false);
      expect(w.get('adutores'), name).toBe(0.5);
      expect(w.get('lombares'), name).toBe(0.5);
    }
  });

  it('agachamento completo pelo nome: adutores 1', () => {
    for (const name of ['Barbell Full Squat', 'Olympic Squat', 'Agachamento completo']) {
      expect(muscleWeights(squat(name), 0.5).get('adutores'), name).toBe(1);
    }
  });

  it('unilaterais, máquinas, saltos e sumo ficam com o peso por defeito (sem estudo)', () => {
    for (const name of ['Dumbbell Bulgarian Split Squat', 'Machine Hack Squat', 'Pendulum Squat', 'Jump Squat', 'Pistol Squat', 'Dumbbell Sumo Squat', 'Belt Squat', 'Squat Jerk']) {
      expect(muscleWeights(squat(name), 0.5).get('isquiotibiais'), name).toBe(0.5);
      expect(overrideFor(name, 'isquiotibiais'), name).toBeNull();
    }
  });

  it('sem nome não há exceções', () => {
    expect(muscleWeights({ ...squat('x'), name: undefined }, 0.5).get('isquiotibiais')).toBe(0.5);
  });

  it('um músculo principal nunca perde peso por uma exceção', () => {
    const odd: MetricExercise = { ...squat('Barbell Back Squat'), primaryMuscles: ['quadriceps', 'isquiotibiais'] };
    expect(muscleWeights(odd, 0.5).get('isquiotibiais')).toBe(1);
  });

  it('cada exceção aponta para uma regra com fonte', () => {
    for (const o of INDIRECT_OVERRIDES) {
      expect(RULE[o.rule], o.rule).toBeTruthy();
      expect(RULE[o.rule].mark).toBe('source');
    }
  });
});

describe('volume semanal e recuperação usam os mesmos pesos', () => {
  const NOW = new Date('2026-10-19T12:00:00Z');
  const set = (exerciseId: string): MetricSet => ({
    exerciseId, sessionId: 's1', weightKg: 100, reps: 8, rir: 2, type: 'working', performedAt: new Date(NOW.getTime() - 3_600_000),
  });
  const ex = new Map([['Barbell Back Squat', squat('Barbell Back Squat')], ['bench', bench]]);
  const sets = [set('Barbell Back Squat'), set('Barbell Back Squat'), set('Barbell Back Squat'), set('bench'), set('bench')];

  it('3 séries de agachamento e 2 de supino', () => {
    const v = weeklyVolume(sets, ex, new Date(NOW.getTime() - 7 * 86_400_000), NOW).sets;
    expect(v.get('quadriceps')).toBe(3);
    expect(v.get('adutores')).toBe(1.5);
    expect(v.get('isquiotibiais')).toBeUndefined();
    expect(v.get('triceps')).toBe(1);
  });

  it('com o peso dos secundários a 0,25 nas Definições', () => {
    const v = weeklyVolume(sets, ex, new Date(NOW.getTime() - 7 * 86_400_000), NOW, rulesWithSecondaryWeight(0.25)).sets;
    expect(v.get('triceps')).toBe(0.5);
    expect(v.get('peito')).toBe(2);
    expect(VOLUME_RULES.indirect_set_weight).toBe(0.5);
  });

  it('a recuperação também não conta os isquiotibiais do agachamento', () => {
    const r = lastStimuli(sets, ex, NOW);
    expect(r.find((s) => s.muscle === 'isquiotibiais')).toBeUndefined();
    expect(r.find((s) => s.muscle === 'adutores')?.sets).toBe(1.5);
  });
});
