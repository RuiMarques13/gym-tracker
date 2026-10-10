/**
 * Lógica pura do temporizador. O estado guarda um instante absoluto de fim (endsAt),
 * nunca um contador: assim o tempo certo sobrevive a ecrã bloqueado, separador em segundo plano ou recarga.
 */
export type TimerKind = 'REST' | 'WORK';

export interface TimerState {
  kind: TimerKind;
  label: string;
  /** Duração total atual (muda com ±15 s), em segundos. */
  totalSeconds: number;
  /** Instante de fim (ms desde 1970). Ignorado enquanto estiver em pausa. */
  endsAt: number;
  /** Se em pausa: milissegundos que faltavam. */
  pausedRemainingMs: number | null;
  /** Instante em que arrancou, para saber o tempo feito (cronómetro de duração). */
  startedAt: number;
}

export function startTimer(kind: TimerKind, label: string, seconds: number, now: number): TimerState {
  const total = Math.max(1, Math.round(seconds));
  return { kind, label, totalSeconds: total, endsAt: now + total * 1000, pausedRemainingMs: null, startedAt: now };
}

export function remainingMs(s: TimerState, now: number): number {
  return s.pausedRemainingMs ?? Math.max(0, s.endsAt - now);
}

/** Segundos a mostrar: arredonda para cima, para o 0:00 só aparecer quando acabou mesmo. */
export function remainingSeconds(s: TimerState, now: number): number {
  return Math.ceil(remainingMs(s, now) / 1000);
}

/** 0 → acabou de começar, 1 → terminou. */
export function progress(s: TimerState, now: number): number {
  return Math.min(1, Math.max(0, 1 - remainingMs(s, now) / (s.totalSeconds * 1000)));
}

export function isFinished(s: TimerState, now: number): boolean {
  return s.pausedRemainingMs === null && now >= s.endsAt;
}

export function isPaused(s: TimerState): boolean {
  return s.pausedRemainingMs !== null;
}

/** Soma (ou tira) segundos, sem deixar o tempo restante ficar negativo. */
export function addSeconds(s: TimerState, delta: number, now: number): TimerState {
  const left = remainingMs(s, now);
  const next = Math.max(1000, left + delta * 1000);
  const total = Math.max(1, Math.round(s.totalSeconds + (next - left) / 1000));
  return isPaused(s)
    ? { ...s, totalSeconds: total, pausedRemainingMs: next }
    : { ...s, totalSeconds: total, endsAt: now + next };
}

export function pause(s: TimerState, now: number): TimerState {
  return isPaused(s) ? s : { ...s, pausedRemainingMs: remainingMs(s, now) };
}

export function resume(s: TimerState, now: number): TimerState {
  return isPaused(s) ? { ...s, endsAt: now + s.pausedRemainingMs!, pausedRemainingMs: null } : s;
}

/** Tempo realmente decorrido desde o arranque, sem contar a pausa, em segundos inteiros. */
export function elapsedSeconds(s: TimerState, now: number): number {
  return Math.min(s.totalSeconds, Math.max(0, Math.round(s.totalSeconds - remainingMs(s, now) / 1000)));
}

/** 75 → «1:15»; 3725 → «1:02:05». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
