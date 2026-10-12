import { describe, expect, it } from 'vitest';
import { COUNTDOWN_MS, parseRun, phaseOf, startRun } from './cardio-run';

describe('atividade de cardio', () => {
  it('conta 5 s a regredir e depois cronometra', () => {
    const r = startRun('e1', 'Caminhada', 1000);
    expect(r.goAtMs).toBe(1000 + COUNTDOWN_MS);
    expect(phaseOf(r, 1000)).toEqual({ phase: 'countdown', remaining: 5, fraction: 1 });
    expect(phaseOf(r, 3500)).toMatchObject({ phase: 'countdown', remaining: 3 });
    expect(phaseOf(r, 5999)).toMatchObject({ phase: 'countdown', remaining: 1 });
    expect(phaseOf(r, 6000)).toEqual({ phase: 'running', elapsedSeconds: 0 });
    expect(phaseOf(r, 6000 + 90_500)).toEqual({ phase: 'running', elapsedSeconds: 90 });
  });

  it('recupera uma corrida guardada e ignora lixo ou corridas velhas', () => {
    const r = startRun('e1', 'Corrida', 0);
    expect(parseRun(JSON.stringify(r), 10_000)).toEqual(r);
    expect(parseRun(null, 0)).toBeNull();
    expect(parseRun('{', 0)).toBeNull();
    expect(parseRun('{"exerciseId":1}', 0)).toBeNull();
    expect(parseRun(JSON.stringify(r), 13 * 3600 * 1000)).toBeNull();
  });
});
