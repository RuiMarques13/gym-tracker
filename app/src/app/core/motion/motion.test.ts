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
    expect(id('Curl inclinado')).toBe('curl-incline');
    expect(id('Agachamento sumo')).toBe('squat-sumo');
    expect(id('Sumo deadlift')).toBe('deadlift');
    expect(id('Pistol squat')).toBe('pistol');
    expect(id('Wall sit')).toBe('wallsit');
    expect(id('Leg press')).toBe('legpress');
    expect(id('Gato-camelo')).toBe('mob-catcamel');
    expect(id('Bicicleta: spinning')).toBe('bike');
  });

  it('sem pista no nome, usa o músculo principal (só em força)', () => {
    expect(motionFor('Exercício esquisito', ['gemeos'])?.id).toBe('calf');
    expect(motionFor('Exercício esquisito', [])).toBeNull();
    expect(motionFor('Exercício esquisito', ['gemeos'], 'MOBILITY')).toBeNull();
  });

  it('prensa: joelho fecha ~100° em baixo e não bloqueia em cima, com a anca fixa', () => {
    const m = MOTIONS['legpress'];
    const hip = (f: typeof m.from) => f.lines[0].split(' ').at(-1)!;
    expect(hip(m.from)).toBe(hip(m.to));
    const knee = (f: typeof m.from) => f.lines[0].split(' ')[2].split(',').map(Number);
    const hipP = hip(m.from).split(',').map(Number);
    const ankle = (f: typeof m.from) => f.lines[0].split(' ')[1].split(',').map(Number);
    const ang = (f: typeof m.from) => {
      const k = knee(f), a = ankle(f);
      const v1 = [hipP[0] - k[0], hipP[1] - k[1]], v2 = [a[0] - k[0], a[1] - k[1]];
      return Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))) * 180 / Math.PI;
    };
    expect(ang(m.to)).toBeGreaterThan(90);
    expect(ang(m.to)).toBeLessThan(110);
    expect(ang(m.from)).toBeGreaterThan(160);
    expect(ang(m.from)).toBeLessThan(178);
  });
});
