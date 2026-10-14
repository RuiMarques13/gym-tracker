import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../library/library-data';
import { PORTION, PORTIONS, PORTIONS_OF_KEY } from './portions';
import { familyOf, portionsFor } from './profiles';
import { SOURCES } from './sources';

const strength = LIBRARY.items.filter((i) => i.kind === 'STRENGTH');
const of = (name: string) => {
  const i = LIBRARY.items.find((x) => x.name === name);
  if (!i) throw new Error(`não existe ${name}`);
  return portionsFor({ name: i.name, namePt: i.namePt, equipment: i.equipment, primaryKeys: i.primary, secondaryKeys: i.secondary, kind: i.kind });
};

describe('porções e fontes', () => {
  it('39 porções, ids únicos', () => {
    expect(PORTIONS.length).toBe(39);
    expect(new Set(PORTIONS.map((p) => p.id)).size).toBe(39);
  });
  it('todas as chaves guardadas na biblioteca têm porções', () => {
    const keys = new Set(LIBRARY.items.flatMap((i) => [...i.primary, ...i.secondary]));
    const missing = [...keys].filter((k) => !PORTIONS_OF_KEY[k]);
    expect(missing).toEqual([]);
  });
});

describe('portionsFor', () => {
  it('cada exercício de força da biblioteca dá pelo menos uma porção principal', () => {
    const empty = strength.filter((i) => !/neck/i.test(i.name) && !portionsFor({ name: i.name, namePt: i.namePt, equipment: i.equipment, primaryKeys: i.primary, secondaryKeys: i.secondary }).primary.length);
    expect(empty.map((i) => i.name)).toEqual([]);
  });
  it('todas as fontes citadas existem', () => {
    for (const i of strength) {
      const p = portionsFor({ name: i.name, namePt: i.namePt, equipment: i.equipment, primaryKeys: i.primary, secondaryKeys: i.secondary });
      for (const inf of Object.values(p.info)) for (const s of inf!.sources) expect(SOURCES[s], s).toBeTruthy();
    }
  });
  it('nenhuma porção é principal e secundária ao mesmo tempo', () => {
    for (const i of strength) {
      const p = portionsFor({ name: i.name, namePt: i.namePt, equipment: i.equipment, primaryKeys: i.primary, secondaryKeys: i.secondary });
      expect(p.primary.filter((x) => p.secondary.includes(x))).toEqual([]);
    }
  });
  it('extensão de tríceps na polia por cima da cabeça → cabeça longa, confiança A', () => {
    const p = portionsFor({ name: 'Overhead Cable Triceps Extension', equipment: 'cable', primaryKeys: ['triceps'], secondaryKeys: [] });
    expect(p.primary).toEqual(['triceps_long']);
    expect(p.info.triceps_long).toMatchObject({ role: 'primary', confidence: 'A', sources: ['maeo2022'] });
  });
  it('mesmo exercício com halter desce para B', () => {
    const p = portionsFor({ name: 'Overhead Dumbbell Triceps Extension', equipment: 'dumbbell', primaryKeys: ['triceps'], secondaryKeys: [] });
    expect(p.info.triceps_long?.confidence).toBe('B');
  });
  it('gémeos sentado → sóleo principal (A)', () => {
    const p = portionsFor({ name: 'Seated Calf Raise', equipment: 'machine', primaryKeys: ['calves'], secondaryKeys: [] });
    expect(p.primary).toEqual(['soleus']);
    expect(p.info.soleus?.confidence).toBe('A');
  });
  it('russian twist → oblíquos principal (C, anatomia)', () => {
    const p = portionsFor({ name: 'Russian Twist', namePt: 'Russian twist', equipment: null, primaryKeys: ['obliques'], secondaryKeys: ['abs'] });
    expect(p.primary).toContain('obliques');
    expect(p.info.obliques).toMatchObject({ confidence: 'C', sources: ['physiopedia'] });
  });
  it('supino inclinado com barra → peitoral clavicular A', () => {
    const p = portionsFor({ name: 'Incline Barbell Bench Press', equipment: 'barbell', primaryKeys: ['chest'], secondaryKeys: ['front_delt', 'triceps'] });
    expect(p.primary).toEqual(['pec_clavicular']);
    expect(p.info.pec_clavicular?.confidence).toBe('A');
    // tríceps guardado como secundário e não coberto pela regra entra como C
    expect(p.info.triceps_long).toMatchObject({ role: 'secondary', confidence: 'C' });
  });
  it('sem regra: usa os grupos guardados com confiança C', () => {
    const p = portionsFor({ name: 'Mystery Move', equipment: null, primaryKeys: ['quadriceps'], secondaryKeys: ['glutes'] });
    expect(p.family).toBeNull();
    expect(p.primary).toEqual(['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius']);
    expect(p.secondary).toEqual(['glute_max']);
  });
  it('não-força não usa regras', () => {
    expect(portionsFor({ name: 'Plank', equipment: null, primaryKeys: ['abs'], secondaryKeys: [], kind: 'CARDIO' }).family).toBeNull();
  });
  it('famílias em PT e EN', () => {
    expect(familyOf('Anything', 'Puxada à frente')).toBe('Puxada');
    expect(familyOf('Lat Pulldown')).toBe('Puxada');
    expect(familyOf('Leg Curl')).toBe('Leg curl');
    expect(familyOf('Seated Leg Curl')).toBe('Leg curl sentado');
  });
  it('porções têm grupo do spec ou null', () => {
    for (const p of PORTIONS) expect(p.group === null || typeof p.group === 'string').toBe(true);
    expect(PORTION.serratus.group).toBeNull();
  });
});
