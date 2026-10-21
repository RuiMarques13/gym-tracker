import { describe, expect, it } from 'vitest';
import { pickTodayWorkout, weekStrip, type DayPlanned, type WorkoutOption } from './today';

// Semana de 2026-10-19 (segunda) a 25; hoje quarta 21.
const TODAY = '2026-10-21';
const plan = (date: string, name: string, status: DayPlanned['status'] = 'PLANNED'): DayPlanned =>
  ({ id: `p-${date}`, date, templateId: `t-${name}`, name, status });

describe('semana em 7 dias', () => {
  it('feito, hoje planeado, futuro planeado, vazios', () => {
    const days = weekStrip(TODAY, [{ date: '2026-10-19', name: 'Empurrar' }], [plan(TODAY, 'Pernas'), plan('2026-10-23', 'Superior')]);
    expect(days.map((d) => d.kind)).toEqual(['done', 'empty', 'planned', 'empty', 'planned', 'empty', 'empty']);
    expect(days[2]).toMatchObject({ today: true, name: 'Pernas', future: false });
    expect(days[2].planned?.templateId).toBe('t-Pernas');
    expect(days[4]).toMatchObject({ future: true, name: 'Superior' });
  });

  it('planeado passado por fazer: falhado; saltado; marcado como feito', () => {
    const days = weekStrip(TODAY, [], [plan('2026-10-19', 'A'), plan('2026-10-20', 'B', 'SKIPPED'), plan(TODAY, 'C', 'DONE')]);
    expect(days.slice(0, 3).map((d) => d.kind)).toEqual(['missed', 'skipped', 'done']);
    expect(days[0].planned).toBeNull();
  });

  it('hoje feito com outro planeado ainda aberto', () => {
    const d = weekStrip(TODAY, [{ date: TODAY, name: null }], [plan(TODAY, 'Tarde')])[2];
    expect(d.kind).toBe('done');
    expect(d.planned?.name).toBe('Tarde');
  });

  it('outras semanas ficam de fora', () => {
    expect(weekStrip(TODAY, [{ date: '2026-10-18', name: 'X' }], [plan('2026-10-26', 'Y')]).every((d) => d.kind === 'empty')).toBe(true);
  });
});

describe('treino a sugerir sem plano', () => {
  const w = (name: string, muscles: string[], last: string | null): WorkoutOption =>
    ({ id: name, name, muscles, lastDoneAt: last ? new Date(last) : null });

  it('o feito há mais tempo entre os que têm os músculos prontos', () => {
    const opts = [w('Pernas', ['quadriceps', 'gluteos'], '2026-10-15'), w('Empurrar', ['peito', 'triceps'], '2026-10-10'), w('Puxar', ['costas_dorsais'], '2026-10-17')];
    expect(pickTodayWorkout(opts, new Set(['peito']))?.name).toBe('Pernas');
    expect(pickTodayWorkout(opts, new Set())?.name).toBe('Empurrar');
  });

  it('nunca feito vem primeiro; sem músculos não conta', () => {
    expect(pickTodayWorkout([w('A', ['peito'], '2026-10-01'), w('Novo', ['costas_dorsais'], null), w('Mobilidade', [], null)], new Set())?.name).toBe('Novo');
  });

  it('nada encaixa: null', () => {
    expect(pickTodayWorkout([w('Pernas', ['quadriceps'], null)], new Set(['quadriceps']))).toBeNull();
    expect(pickTodayWorkout([], new Set())).toBeNull();
  });
});
