import { describe, expect, it } from 'vitest';
import { normalizeWidgets } from './widget-list';

describe('normalizeWidgets', () => {
  it('converte o id antigo, tira desconhecidos e repetidos e mantém a ordem', () => {
    expect(normalizeWidgets(['mobility-minutes', 'weekly-sets', 'nada', 'volume-week', 'next-workout'])).toEqual([
      'mobility-minutes', 'volume-week', 'next-workout',
    ]);
  });
});
