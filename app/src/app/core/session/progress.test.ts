import { describe, expect, it } from 'vitest';
import { MAX_DOTS, setDots, workoutProgress } from './progress';

describe('progresso do treino', () => {
  it('soma as séries feitas e as previstas', () => {
    expect(workoutProgress([{ workingSets: 2, targetSets: 4 }, { workingSets: 0, targetSets: 3 }])).toEqual({ done: 2, total: 7 });
  });

  it('séries a mais aumentam o total (a barra não passa de 100%)', () => {
    expect(workoutProgress([{ workingSets: 5, targetSets: 4 }])).toEqual({ done: 5, total: 5 });
  });

  it('exercício sem alvo conta só o que fizeste', () => {
    expect(workoutProgress([{ workingSets: 2, targetSets: 3 }, { workingSets: 1, targetSets: null }])).toEqual({ done: 3, total: 4 });
  });

  it('sessão livre (nenhum alvo): sem total', () => {
    expect(workoutProgress([{ workingSets: 3, targetSets: null }])).toEqual({ done: 3, total: null });
    expect(workoutProgress([])).toEqual({ done: 0, total: null });
  });
});

describe('bolinhas de um exercício', () => {
  it('feitas, a seguinte e as que faltam', () => {
    expect(setDots(2, 4)).toEqual(['done', 'done', 'next', 'todo']);
    expect(setDots(0, 2)).toEqual(['next', 'todo']);
  });

  it('todas feitas e séries a mais', () => {
    expect(setDots(3, 3)).toEqual(['done', 'done', 'done']);
    expect(setDots(4, 3)).toEqual(['done', 'done', 'done', 'done']);
  });

  it('sem alvo não há bolinhas; no máximo MAX_DOTS', () => {
    expect(setDots(2, null)).toEqual([]);
    expect(setDots(0, 30)).toHaveLength(MAX_DOTS);
  });
});
