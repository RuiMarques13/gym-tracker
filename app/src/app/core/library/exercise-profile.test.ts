import { describe, expect, it } from 'vitest';
import { LIBRARY } from './library-data';
import { profileFor } from './exercise-profile';

describe('perfil muscular curado', () => {
  const byName = (n: string) => LIBRARY.items.find((i) => i.name === n || i.namePt === n)!;
  it('cobre todos os exercícios de força do teu catálogo', () => {
    const miss = LIBRARY.items
      .filter((i) => i.source === 'catalog' && i.kind === 'STRENGTH' && !profileFor(i.namePt ?? i.name))
      .map((i) => i.name);
    expect(miss).toEqual([]);
  });
  it('casos que falhavam', () => {
    expect(byName('Leg curl deitado').primary).toEqual(['hamstrings']);
    expect(byName('Supino plano (barra)').primary).toEqual(['chest']);
    expect(byName('Face pull (cabo)').primary).toEqual(['rear_delt']);
    expect(byName('Hip thrust (barra)').movementType).toBe('PUSH');
    expect(byName('Kickback (elástico)').secondary).not.toContain('glutes');
    expect(byName('Snatch (barra)').primary.length).toBeGreaterThan(0);
  });
  it('só usa músculos que existem', () => {
    const ok = new Set(['quadriceps','glutes','hamstrings','adductors','calves','chest','biceps','triceps','forearms','abs','lower_back','abductors','tibialis','obliques','neck','lats','upper_back','front_delt','side_delt','rear_delt']);
    for (const i of LIBRARY.items) for (const m of [...i.primary, ...i.secondary]) expect(ok.has(m), `${i.name}: ${m}`).toBe(true);
  });
});
