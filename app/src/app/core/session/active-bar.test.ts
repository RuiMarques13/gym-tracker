import { describe, expect, it } from 'vitest';
import type { Session, SessionExercise, SessionSet } from '../../data/models/session';
import { activeBarInfo, activeBarVisible, formatElapsed, STALE_AFTER_MS } from './active-bar';

const START = Date.parse('2026-11-01T17:00:00Z');

const set = (position: number, side: SessionSet['side'] = 'BOTH'): SessionSet => ({
  id: `${position}${side}`, position, type: 'WORKING', side, weightKg: 60, reps: 10, durationSeconds: null, distanceM: null,
  caloriesKcal: null, rpe: null, rir: null, romScore: null, restSecondsActual: null, completedAt: null,
});

const exercise = (sets: SessionSet[]): SessionExercise => ({ sets } as unknown as SessionExercise);

const session = (over: Partial<Session> = {}): Session => ({
  id: 's', templateId: null, templateName: 'Treino A', scheduledId: null, startedAt: new Date(START).toISOString(),
  endedAt: null, pausedSeconds: 0, rpe: null, notes: null, lastActivityAt: null, exercises: [], ...over,
});

describe('formatElapsed', () => {
  it('minutos até à hora, depois horas e minutos', () => {
    expect(formatElapsed(0)).toBe('0 min');
    expect(formatElapsed(59)).toBe('0 min');
    expect(formatElapsed(32 * 60 + 40)).toBe('32 min');
    expect(formatElapsed(3600)).toBe('1 h 00');
    expect(formatElapsed(3600 + 5 * 60)).toBe('1 h 05');
  });
  it('nunca negativo (relógios desacertados)', () => {
    expect(formatElapsed(-30)).toBe('0 min');
  });
});

describe('activeBarInfo', () => {
  it('nome, tempo sem pausas e séries', () => {
    const s = session({
      pausedSeconds: 120,
      exercises: [exercise([set(1), set(2)]), exercise([set(1, 'LEFT'), set(1, 'RIGHT')])],
    });
    const info = activeBarInfo(s, START + 32 * 60_000);
    expect(info.name).toBe('Treino A');
    expect(info.elapsed).toBe('30 min');
    expect(info.sets).toBe(3); // esquerdo e direito contam uma
    expect(info.stale).toBe(false);
  });
  it('sem treino de origem é uma sessão livre', () => {
    expect(activeBarInfo(session({ templateName: null }), START).name).toBe('Sessão livre');
  });
  it('esquecida: 4 h sem atividade desde a última série (ou desde o início)', () => {
    expect(activeBarInfo(session(), START + STALE_AFTER_MS).stale).toBe(true);
    expect(activeBarInfo(session(), START + STALE_AFTER_MS - 1).stale).toBe(false);
    const recent = session({ lastActivityAt: new Date(START + 3 * 3600_000).toISOString() });
    expect(activeBarInfo(recent, START + STALE_AFTER_MS + 1).stale).toBe(false);
  });
});

describe('activeBarVisible', () => {
  it('fora da Home e fora do treino', () => {
    expect(activeBarVisible('/treinos')).toBe(true);
    expect(activeBarVisible('/historico/abc')).toBe(true);
    expect(activeBarVisible('/perfil')).toBe(true);
  });
  it('não na Home (tem o cartão) nem na sessão', () => {
    expect(activeBarVisible('/home')).toBe(false);
    expect(activeBarVisible('/')).toBe(false);
    expect(activeBarVisible('/sessao')).toBe(false);
    expect(activeBarVisible('/sessao/fim/abc')).toBe(false);
  });
});
