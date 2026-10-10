import { describe, expect, it } from 'vitest';
import { refineMuscles } from './muscle-refine';
import { LIBRARY } from './library-data';

describe('refineMuscles', () => {
  it('puxada → dorsais; remada → dorsais + superiores', () => {
    expect(refineMuscles('Puxada à frente', { primary: ['back'], secondary: ['biceps'] }).primary).toEqual(['lats']);
    expect(refineMuscles('Remada curvada', { primary: ['back'], secondary: ['biceps'] }).primary).toEqual(['lats', 'upper_back']);
  });
  it('ombros: lateral, frontal, posterior, desenvolvimento', () => {
    const p = (n: string) => refineMuscles(n, { primary: ['shoulders'], secondary: [] }).primary;
    expect(p('Elevação lateral')).toEqual(['side_delt']);
    expect(p('Elevação frontal')).toEqual(['front_delt']);
    expect(p('Elevações posteriores')).toEqual(['rear_delt']);
    expect(p('Desenvolvimento sentado')).toEqual(['front_delt', 'side_delt']);
  });
  it('ombros secundários → deltoide anterior; trapézio → costas superiores', () => {
    const r = refineMuscles('Supino', { primary: ['chest'], secondary: ['triceps', 'shoulders'] });
    expect(r.secondary).toEqual(['triceps', 'front_delt']);
    expect(refineMuscles('Encolhimentos', { primary: ['traps'], secondary: [] }).primary).toEqual(['upper_back']);
  });
  it('a biblioteca já não usa chaves antigas e todos os de força têm primários', () => {
    const legacy = new Set(['back', 'shoulders', 'traps']);
    for (const i of LIBRARY.items) {
      expect([...i.primary, ...i.secondary].some((k) => legacy.has(k)), i.name).toBe(false);
    }
  });
});
