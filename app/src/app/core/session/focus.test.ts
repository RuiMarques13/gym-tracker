import { describe, expect, it } from 'vitest';
import { currentExerciseId, isFinished, openExerciseId, type FocusExercise } from './focus';

const ex = (id: string, workingSets: number, targetSets: number | null = 3): FocusExercise => ({ id, workingSets, targetSets });

describe('exercício atual', () => {
  it('com alvos: o primeiro que ainda não chegou às séries alvo', () => {
    expect(currentExerciseId([ex('a', 3), ex('b', 1), ex('c', 0)])).toBe('b');
    expect(currentExerciseId([ex('a', 0), ex('b', 0)])).toBe('a');
  });

  it('séries a mais não mudam nada; tudo feito: null', () => {
    expect(currentExerciseId([ex('a', 4), ex('b', 3)])).toBeNull();
  });

  it('saltar um exercício: o atual continua a ser o que ficou por fazer', () => {
    expect(currentExerciseId([ex('a', 1), ex('b', 3), ex('c', 0)])).toBe('a');
  });

  it('sem alvo (sessão livre): continua no mesmo até começares o seguinte', () => {
    expect(currentExerciseId([ex('a', 5, null), ex('b', 0, null)])).toBe('a');
    expect(currentExerciseId([ex('a', 5, null), ex('b', 1, null)])).toBe('b');
    expect(isFinished(ex('a', 0, null), [ex('b', 2, null)])).toBe(false);
  });

  it('alvo zero conta como sem alvo', () => {
    expect(isFinished(ex('a', 2, 0), [])).toBe(false);
  });
});

describe('exercício aberto', () => {
  it('o que escolheste ganha ao atual', () => {
    expect(openExerciseId([ex('a', 0), ex('b', 0)], 'b')).toBe('b');
  });
  it('escolha que já não existe (exercício tirado): volta ao atual', () => {
    expect(openExerciseId([ex('a', 0), ex('b', 0)], 'x')).toBe('a');
  });
  it('tudo feito: fica o último aberto; sessão vazia: nenhum', () => {
    expect(openExerciseId([ex('a', 3), ex('b', 3)], null)).toBe('b');
    expect(openExerciseId([], null)).toBeNull();
  });
});
