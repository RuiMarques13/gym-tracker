import { describe, expect, it } from 'vitest';
import { loadOptions, repRange, suggestLoad, type PastSession } from './load';

const s = (w: number, ...reps: number[]): PastSession => ({ sets: reps.map((r) => ({ weightKg: w, reps: r, rir: null })) });
const rir = (w: number, rr: number, ...reps: number[]): PastSession => ({ sets: reps.map((r) => ({ weightKg: w, reps: r, rir: rr })) });

describe('suggestLoad', () => {
  it('supino 60 kg, 3×12 em duas sessões, faixa 8–12, barra 2,5 kg → 62,5 kg (opções 62,5 e 65)', () => {
    const r = suggestLoad({ history: [s(60, 12, 12, 12), s(60, 12, 12, 12)], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2.5 });
    expect(r).toMatchObject({ action: 'increase', weightKg: 62.5, options: [62.5, 65], rangeKg: [61.2, 66], basis: 'ACSM 2009' });
  });

  it('monoarticular escolhe a carga possível mais baixa', () => {
    const r = suggestLoad({ history: [s(40, 12, 12), s(40, 12, 12)], repsMin: 8, repsMax: 12, mechanic: 'ISOLATION', incrementKg: 1 });
    expect(r.weightKg).toBe(41);
    expect(r.options).toEqual([41, 42, 43, 44]);
  });

  it('halter de 8 kg com saltos de 2,5 kg: mais repetições até 15 e só depois 10,5 kg', () => {
    const base = { repsMin: 8, repsMax: 12, mechanic: 'ISOLATION' as const, incrementKg: 2.5 };
    const a = suggestLoad({ ...base, history: [s(8, 12, 12), s(8, 12, 12)] });
    expect(a).toMatchObject({ action: 'reps', weightKg: 8, repsMin: 13, repsMax: 15 });
    const b = suggestLoad({ ...base, history: [s(8, 15, 15), s(8, 14, 13)] });
    expect(b).toMatchObject({ action: 'increase', weightKg: 10.5, basis: 'app' });
  });

  it('só uma sessão no topo → repete a carga', () => {
    const r = suggestLoad({ history: [s(60, 12, 12, 12), s(60, 11, 10, 10)], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2.5 });
    expect(r).toMatchObject({ action: 'hold', weightKg: 60 });
  });

  it('RIR 4 ou mais no topo sobe já na sessão seguinte', () => {
    const r = suggestLoad({ history: [rir(60, 4, 12, 12, 12)], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2.5 });
    expect(r.action).toBe('increase');
  });

  it('unilateral: decide pelo lado mais fraco (uma série abaixo do topo chega para não subir)', () => {
    const uni: PastSession = { sets: [{ weightKg: 20, reps: 12, rir: null }, { weightKg: 20, reps: 10, rir: null }] };
    const r = suggestLoad({ history: [uni, uni], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2 });
    expect(r.action).toBe('hold');
  });

  it('abaixo do mínimo em duas sessões → desce um incremento', () => {
    const r = suggestLoad({ history: [s(80, 6, 5), s(80, 7, 6)], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2.5 });
    expect(r).toMatchObject({ action: 'decrease', weightKg: 77.5 });
  });

  it('sem histórico ou sem carga → start', () => {
    expect(suggestLoad({ history: [], repsMin: 8, repsMax: 12, mechanic: null, incrementKg: 2.5 }).action).toBe('start');
  });

  it('sem incremento mostra o intervalo sem escolher', () => {
    const r = suggestLoad({ history: [s(50, 12), s(50, 12)], repsMin: 8, repsMax: 12, mechanic: null, incrementKg: null });
    expect(r).toMatchObject({ action: 'increase', weightKg: null, rangeKg: [51, 55] });
  });

  it('séries mais leves (aproximação) não contam: decide pela carga do topo', () => {
    const h: PastSession = { sets: [{ weightKg: 40, reps: 8, rir: null }, { weightKg: 60, reps: 12, rir: null }, { weightKg: 60, reps: 12, rir: null }] };
    expect(suggestLoad({ history: [h, h], repsMin: 8, repsMax: 12, mechanic: 'COMPOUND', incrementKg: 2.5 }).weightKg).toBe(62.5);
  });
});

describe('repRange e loadOptions', () => {
  it('faixa', () => {
    expect(repRange({ targetRepsMin: 8, targetReps: 12 })).toEqual([8, 12]);
    expect(repRange({ targetRepsMin: null, targetReps: 10 })).toEqual([8, 12]);
    expect(repRange({ targetRepsMin: null, targetReps: null }, [4, 6])).toEqual([4, 6]);
  });
  it('opções', () => {
    expect(loadOptions(100, 2.5, 102, 110)).toEqual([102.5, 105, 107.5, 110]);
  });
});
