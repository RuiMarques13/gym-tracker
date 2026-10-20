import { describe, expect, it } from 'vitest';
import { bestOf, recordOf, sessionRecords, type RecordSet } from './records';

const w = (weightKg: number, reps: number, rir: number | null = null, exerciseId = 'sq'): RecordSet =>
  ({ exerciseId, weightKg, reps, rir, type: 'working' });

describe('melhor de sempre', () => {
  it('maior carga e maior 1RM estimado (Epley até 10 repetições com a reserva)', () => {
    const b = bestOf([w(100, 5), w(90, 8), w(60, 20)]).get('sq')!;
    expect(b.weightKg).toBe(100);
    expect(b.e1rm).toBe(116.7); // 100 × (1 + 5/30)
  });

  it('aquecimento e séries sem carga não contam', () => {
    expect(bestOf([{ ...w(140, 3), type: 'warmup' }, w(0, 10)]).has('sq')).toBe(false);
  });
});

describe('recorde numa série', () => {
  const prev = { weightKg: 100, e1rm: 116.7 };

  it('mais carga do que nunca', () => {
    expect(recordOf(w(102.5, 3), prev)).toMatchObject({ kind: 'weight', value: 102.5, previous: 100 });
  });

  it('mesma carga, mais repetições: 1RM estimado maior', () => {
    expect(recordOf(w(100, 6), prev)).toMatchObject({ kind: 'e1rm', value: 120, previous: 116.7 });
  });

  it('as repetições em reserva contam para o 1RM estimado', () => {
    expect(recordOf(w(100, 5, 1), prev)).toMatchObject({ kind: 'e1rm' });
  });

  it('igual não é recorde; acima de 10 repetições não há 1RM estimado', () => {
    expect(recordOf(w(100, 5), prev)).toBeNull();
    expect(recordOf(w(95, 12), prev)).toBeNull();
  });

  it('primeira vez no exercício não é recorde', () => {
    expect(recordOf(w(100, 5), undefined)).toBeNull();
  });

  it('aquecimento não é recorde', () => {
    expect(recordOf({ ...w(120, 1), type: 'warmup' }, prev)).toBeNull();
  });
});

describe('recordes de uma sessão', () => {
  it('um por exercício, o último batido', () => {
    const r = sessionRecords([w(100, 5)], [w(100, 6), w(102.5, 5), w(80, 10)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'weight', value: 102.5 });
  });

  it('cada série compara com as anteriores da sessão', () => {
    expect(sessionRecords([w(100, 5)], [w(102.5, 5), w(102.5, 5)])).toHaveLength(1);
  });

  it('exercício novo não dá recorde', () => {
    expect(sessionRecords([w(100, 5)], [w(50, 10, null, 'bench')])).toEqual([]);
  });
});
