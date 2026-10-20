import { describe, expect, it } from 'vitest';
import { weekPath, type PathPlanned } from './week-path';

// Semana de 2026-10-19 (segunda) a 25; hoje quarta 21.
const TODAY = '2026-10-21';
const plan = (date: string, name: string, status: PathPlanned['status'] = 'PLANNED'): PathPlanned =>
  ({ id: `p-${date}`, date, templateId: `t-${name}`, name, status });

describe('caminho da semana', () => {
  it('feitos, hoje com o planeado e os próximos', () => {
    const steps = weekPath(TODAY, [{ date: '2026-10-19', name: 'Empurrar' }], [plan('2026-10-21', 'Pernas'), plan('2026-10-23', 'Puxar')]);
    expect(steps.map((s) => [s.date, s.kind, s.name])).toEqual([
      ['2026-10-19', 'done', 'Empurrar'],
      ['2026-10-21', 'today', 'Pernas'],
      ['2026-10-23', 'planned', 'Puxar'],
    ]);
    expect(steps[1].planned?.templateId).toBe('t-Pernas');
  });

  it('hoje aparece sempre, mesmo sem nada planeado', () => {
    const steps = weekPath(TODAY, [], []);
    expect(steps).toEqual([{ date: TODAY, weekday: 2, kind: 'today', name: null, sessions: 0, planned: null }]);
  });

  it('hoje já treinado fica feito; outro planeado para hoje aparece a seguir', () => {
    expect(weekPath(TODAY, [{ date: TODAY, name: null }], []).map((s) => s.kind)).toEqual(['done']);
    expect(weekPath(TODAY, [{ date: TODAY, name: 'Manhã' }], [plan(TODAY, 'Tarde')]).map((s) => s.kind)).toEqual(['done', 'today']);
  });

  it('planeado passado por fazer: falhado; saltado: saltado', () => {
    const steps = weekPath(TODAY, [], [plan('2026-10-19', 'A'), plan('2026-10-20', 'B', 'SKIPPED')]);
    expect(steps.map((s) => s.kind)).toEqual(['missed', 'skipped', 'today']);
    expect(steps[0].planned).toBeNull();
  });

  it('dias de outras semanas ficam de fora', () => {
    expect(weekPath(TODAY, [{ date: '2026-10-18', name: 'X' }], [plan('2026-10-26', 'Y')])).toHaveLength(1);
  });

  it('dois treinos no mesmo dia: um passo, com a contagem', () => {
    const steps = weekPath(TODAY, [{ date: '2026-10-20', name: null }, { date: '2026-10-20', name: 'Cardio' }], []);
    expect(steps[0]).toMatchObject({ kind: 'done', name: 'Cardio', sessions: 2 });
  });
});
