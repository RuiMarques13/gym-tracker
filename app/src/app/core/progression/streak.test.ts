import { describe, expect, it } from 'vitest';
import { weeklyStreak } from './streak';

// 2026-10-19 é segunda-feira.
const TODAY = '2026-10-21'; // quarta

describe('sequência semanal', () => {
  it('semanas seguidas com pelo menos 2 dias de treino', () => {
    const days = ['2026-10-05', '2026-10-08', '2026-10-12', '2026-10-17'];
    const s = weeklyStreak(days, TODAY, 2);
    expect(s.weeks).toBe(2);
    expect(s.thisWeek).toBe(0);
    expect(s.thisWeekDone).toBe(false);
  });

  it('a semana em curso soma quando cumpre', () => {
    const s = weeklyStreak(['2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21'], TODAY, 2);
    expect(s.weeks).toBe(2);
    expect(s.thisWeekDone).toBe(true);
  });

  it('uma semana abaixo do objetivo recomeça a contagem', () => {
    const s = weeklyStreak(['2026-09-28', '2026-09-30', '2026-10-06', '2026-10-12', '2026-10-15'], TODAY, 2);
    expect(s.weeks).toBe(1);
  });

  it('dois treinos no mesmo dia contam um dia', () => {
    expect(weeklyStreak(['2026-10-13', '2026-10-13'], TODAY, 2).weeks).toBe(0);
  });

  it('objetivo de 1 treino por semana', () => {
    expect(weeklyStreak(['2026-10-07', '2026-10-14', '2026-10-20'], TODAY, 1).weeks).toBe(3);
  });

  it('dias da semana: com treino, hoje e futuros', () => {
    const s = weeklyStreak(['2026-10-19'], TODAY, 2);
    expect(s.days).toHaveLength(7);
    expect(s.days[0]).toEqual({ date: '2026-10-19', trained: true, today: false, future: false });
    expect(s.days[2]).toMatchObject({ date: TODAY, today: true, future: false });
    expect(s.days[3].future).toBe(true);
  });

  it('sem treinos: zero', () => {
    expect(weeklyStreak([], TODAY, 2)).toMatchObject({ weeks: 0, thisWeek: 0, goal: 2 });
  });
});
