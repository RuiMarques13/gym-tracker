import { describe, expect, it } from 'vitest';
import { ids } from '../util/uuid';
import { portionsForExercise } from './exercise-portions';

const m = (...keys: string[]) => keys.map((k) => ids.muscle(k));
const bench = (primary: string[], secondary: string[]) => portionsForExercise({
  name: 'Dumbbell Bench Press', kind: 'STRENGTH', equipmentId: ids.equipment('dumbbell'),
  primaryMuscleIds: m(...primary), secondaryMuscleIds: m(...secondary),
});

describe('boneco de um exercício guardado segue os músculos escolhidos', () => {
  it('como vem da biblioteca: peito principal, tríceps e deltoide anterior secundários', () => {
    const p = bench(['chest'], ['triceps', 'front_delt']);
    expect(p.primary).toEqual(expect.arrayContaining(['pec_sternal']));
    expect(p.secondary).toEqual(expect.arrayContaining(['delt_front']));
    expect(p.secondary.some((x) => x.startsWith('triceps'))).toBe(true);
  });

  it('tirar o tríceps tira-o do boneco', () => {
    const p = bench(['chest'], ['front_delt']);
    expect([...p.primary, ...p.secondary].some((x) => x.startsWith('triceps'))).toBe(false);
  });

  it('passar o tríceps a principal pinta-o como principal (mantém a cabeça que a regra indica)', () => {
    const before = bench(['chest'], ['triceps']).secondary.filter((x) => x.startsWith('triceps'));
    const p = bench(['chest', 'triceps'], []);
    expect(p.primary).toEqual(expect.arrayContaining(before));
    expect(p.secondary.some((x) => x.startsWith('triceps'))).toBe(false);
  });

  it('juntar um músculo que a regra não tem acrescenta-o', () => {
    const p = bench(['chest', 'biceps'], ['triceps']);
    expect(p.primary).toEqual(expect.arrayContaining(['biceps']));
  });

  it('tirar o peito deixa o boneco sem peitoral', () => {
    const p = bench([], ['triceps']);
    expect([...p.primary, ...p.secondary].some((x) => x.startsWith('pec_'))).toBe(false);
  });
});
