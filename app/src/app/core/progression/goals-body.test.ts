import { describe, expect, it } from 'vitest';
import { RULE } from './rules';
import { defaultRepRange, restByGoal, strengthTarget } from './goals';
import { fourWeekChange, paceBand, paceMessage, weeklyPace, type WeightRecord } from './body';
import { consistentMonths, levelFromMonths, levelSuggestion } from './level';
import { addDays } from '../util/week';

describe('objetivos', () => {
  it('faixa por defeito', () => {
    expect(defaultRepRange('hypertrophy', 'advanced')).toEqual([8, 12]);
    expect(defaultRepRange('strength', 'beginner')).toEqual([8, 12]);
    expect(defaultRepRange('strength', 'intermediate')).toEqual([4, 6]);
  });
  it('força: ~80% do 1RM, para baixo ao incremento', () => {
    expect(strengthTarget(100, 2.5)).toBe(80);
    expect(strengthTarget(103, 2.5)).toBe(80);
    expect(strengthTarget(104, 2.5)).toBe(82.5);
    expect(strengthTarget(30, 4)).toBe(24);
  });
  it('descanso', () => {
    expect(restByGoal('COMPOUND', 'hypertrophy')).toBe(120);
    expect(restByGoal('COMPOUND', 'strength')).toBe(180);
    expect(restByGoal('ISOLATION', 'strength')).toBe(90);
  });
});

const series = (today: string, days: number, start: number, perWeekPct: number): WeightRecord[] =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(today, -i), value: start * (1 - (perWeekPct / 100) * (i / 7)) }));

describe('ritmo de peso', () => {
  const today = '2026-10-15';
  it('precisa de 3 pesagens em cada semana', () => {
    expect(weeklyPace([{ date: today, value: 80 }, { date: addDays(today, -8), value: 81 }], today)).toBeNull();
  });
  it('mede a variação semanal', () => {
    const pace = weeklyPace(series(today, 14, 80, 0.5), today)!;
    expect(pace).toBeGreaterThan(0.45);
    expect(pace).toBeLessThan(0.55);
  });
  it('faixas e mensagens', () => {
    expect(paceBand('strength', 'beginner')).toBeNull();
    expect(paceMessage('cut', 'intermediate', -0.7)).toBeNull();
    expect(paceMessage('cut', 'intermediate', -1.4)).toContain('mais de 1% por semana');
    expect(paceMessage('hypertrophy', 'beginner', 0.8)).toContain('acima');
    expect(paceMessage('hypertrophy', 'advanced', 0.2)).toBeNull();
    expect(paceMessage('maintenance', 'beginner', 0.5)).toContain('estável');
  });
  it('4 semanas', () => {
    expect(fourWeekChange(series(today, 40, 80, 0), today)).toBeCloseTo(0, 5);
  });
  it('as regras citadas existem', () => {
    for (const g of ['hypertrophy', 'cut', 'maintenance'] as const) expect(RULE[paceBand(g, 'beginner')!.rule]).toBeTruthy();
  });
});

describe('nível pelo histórico', () => {
  const today = '2026-10-15';
  const weekly = (weeks: number, skip: number[] = []) =>
    Array.from({ length: weeks }, (_, i) => i).filter((i) => !skip.includes(i)).map((i) => addDays(today, -7 * i));
  it('conta meses seguidos, tolerando pausas de 2 semanas', () => {
    expect(consistentMonths(weekly(30, [5, 6, 20, 21]), today)).toBeGreaterThan(6.5);
    expect(consistentMonths(weekly(30, [10, 11, 12]), today)).toBeLessThan(3);
    expect(consistentMonths([], today)).toBe(0);
  });
  it('parou há 3 semanas: zero', () => {
    expect(consistentMonths(weekly(30).filter((d) => d < addDays(today, -21)), today)).toBe(0);
  });
  it('limiares e só subir', () => {
    expect(levelFromMonths(5)).toBe('beginner');
    expect(levelFromMonths(6)).toBe('intermediate');
    expect(levelFromMonths(40)).toBe('advanced');
    expect(levelSuggestion('beginner', 8)).toBe('intermediate');
    expect(levelSuggestion('advanced', 8)).toBeNull();
    expect(levelSuggestion('intermediate', 8)).toBeNull();
  });
});
