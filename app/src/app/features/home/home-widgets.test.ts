import { describe, expect, it } from 'vitest';
import { normalizeWidgets } from './widget-list';

describe('normalizeWidgets', () => {
  it('converte o id antigo, tira desconhecidos e repetidos e mantém a ordem', () => {
    expect(normalizeWidgets(['mobility-minutes', 'weekly-sets', 'nada', 'volume-week', 'next-workout'])).toEqual([
      'mobility-minutes', 'volume-week', 'next-workout',
    ]);
  });

  it('«os teus exercícios» saiu e dá o lugar ao gráfico do alvo, a seguir ao próximo treino', () => {
    expect(normalizeWidgets(['next-workout', 'volume-week', 'exercise-counts'])).toEqual(['next-workout', 'week-progress', 'volume-week']);
    expect(normalizeWidgets(['volume-week', 'exercise-counts'])).toEqual(['week-progress', 'volume-week']);
    // quem já tem o gráfico ou o tirou à mão não leva um segundo
    expect(normalizeWidgets(['week-progress', 'exercise-counts'])).toEqual(['week-progress']);
    expect(normalizeWidgets(['volume-week'])).toEqual(['volume-week']);
  });
});
