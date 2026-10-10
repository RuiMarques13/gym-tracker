import { describe, expect, it } from 'vitest';
import {
  addSeconds, elapsedSeconds, formatClock, isFinished, pause, progress, remainingSeconds, resume, startTimer,
} from './timer-math';

const T0 = 1_000_000;

describe('timer-math', () => {
  it('conta a partir de um instante absoluto de fim', () => {
    const s = startTimer('REST', 'Squat', 90, T0);
    expect(remainingSeconds(s, T0)).toBe(90);
    expect(remainingSeconds(s, T0 + 30_000)).toBe(60);
    expect(remainingSeconds(s, T0 + 30_100)).toBe(60); // arredonda para cima
    expect(progress(s, T0 + 45_000)).toBeCloseTo(0.5);
    expect(isFinished(s, T0 + 89_999)).toBe(false);
    expect(isFinished(s, T0 + 90_000)).toBe(true);
    // depois de o ecrã estar bloqueado muito tempo continua certo
    expect(remainingSeconds(s, T0 + 10 * 60_000)).toBe(0);
  });

  it('±15 s ajusta o tempo restante e o total, sem ficar negativo', () => {
    let s = startTimer('REST', 'x', 60, T0);
    s = addSeconds(s, 15, T0 + 10_000);
    expect(remainingSeconds(s, T0 + 10_000)).toBe(65);
    expect(s.totalSeconds).toBe(75);
    s = addSeconds(s, -15, T0 + 10_000);
    s = addSeconds(s, -15, T0 + 10_000);
    s = addSeconds(s, -15, T0 + 10_000);
    s = addSeconds(s, -15, T0 + 10_000);
    s = addSeconds(s, -15, T0 + 10_000);
    expect(remainingSeconds(s, T0 + 10_000)).toBe(1);
  });

  it('pausa congela o restante e retomar volta a andar', () => {
    let s = startTimer('WORK', 'Prancha', 60, T0);
    s = pause(s, T0 + 20_000);
    expect(remainingSeconds(s, T0 + 999_999)).toBe(40);
    expect(isFinished(s, T0 + 999_999)).toBe(false);
    s = resume(s, T0 + 100_000);
    expect(remainingSeconds(s, T0 + 110_000)).toBe(30);
    expect(elapsedSeconds(s, T0 + 110_000)).toBe(30);
    s = addSeconds(pause(s, T0 + 110_000), 15, T0 + 120_000);
    expect(remainingSeconds(s, T0 + 130_000)).toBe(45);
  });

  it('formata relógio', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});
