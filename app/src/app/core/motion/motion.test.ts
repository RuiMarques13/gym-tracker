import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../library/library-data';
import { specOfKeys } from '../metrics/muscles';
import { MOTIONS, motionFor } from './motion';

describe('animações', () => {
  it('todas as frames cabem na figura e têm o mesmo número de linhas', () => {
    for (const m of Object.values(MOTIONS)) {
      expect(m.from.lines.length, m.id).toBe(m.to.lines.length);
      expect(m.from.lines.length, m.id).toBe(m.mid.lines.length);
      for (const fr of [m.from, m.mid, m.to]) {
        const all = [...fr.lines.flatMap((l) => l.split(' ').map((p) => p.split(',').map(Number))), fr.head, ...fr.weights];
        for (const [x, y] of all) {
          expect(x, `${m.id} x`).toBeGreaterThanOrEqual(-1);
          expect(x, `${m.id} x`).toBeLessThanOrEqual(101);
          expect(y, `${m.id} y`).toBeGreaterThanOrEqual(-1);
          expect(y, `${m.id} y`).toBeLessThanOrEqual(101);
        }
      }
    }
  });

  it('cada exercício da biblioteca (força, mobilidade e cardio) tem animação', () => {
    const miss = LIBRARY.items.filter((i) => !motionFor(i.name, specOfKeys(i.primary), i.kind)).map((i) => i.name);
    expect(miss).toEqual([]);
  });

  it('exercícios que falhavam', () => {
    const id = (n: string) => motionFor(n, [])?.id;
    expect(id('Supino plano (barra)')).toBe('bench');
    expect(id('Supino inclinado (halteres)')).toBe('bench-incline');
    expect(id('Elevações laterais')).toBe('lateral');
    expect(id('Chest press sentado')).toBe('chestpress');
    expect(id('Chest press inclinado')).toBe('chestpress-incline');
    expect(id('Chest press de pé')).toBe('chestpress-standing');
    expect(id('Chest press com cabos de pé')).toBe('chestpress-standing');
    expect(id('Face pull (cabo)')).toBe('facepull');
    expect(id('Leg curl deitado')).toBe('legcurl-lying');
    expect(id('Hip thrust (barra)')).toBe('hipthrust');
    expect(id('Farmer’s walk')).toBe('carry');
    expect(id('Curl inclinado')).toBe('curl');
    expect(id('Gato-camelo')).toBe('mob-catcamel');
    expect(id('Bicicleta: spinning')).toBe('bike');
  });

  it('sem pista no nome, usa o músculo principal (só em força)', () => {
    expect(motionFor('Exercício esquisito', ['gemeos'])?.id).toBe('calf');
    expect(motionFor('Exercício esquisito', [])).toBeNull();
    expect(motionFor('Exercício esquisito', ['gemeos'], 'MOBILITY')).toBeNull();
  });
});
