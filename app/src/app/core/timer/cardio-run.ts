/** Matemática pura da atividade de cardio ao vivo: contagem de 5 s e depois cronómetro até parares. */
export const COUNTDOWN_MS = 5000;

export interface CardioRun {
  /** Id do exercício na sessão (session_exercise). */
  exerciseId: string;
  name: string;
  /** Instante (ms) em que a contagem acaba e a atividade começa. */
  goAtMs: number;
}

export type CardioPhase =
  | { phase: 'countdown'; /** 5, 4, 3, 2, 1 */ remaining: number; /** 1 → 0 ao longo dos 5 s */ fraction: number }
  | { phase: 'running'; elapsedSeconds: number };

export function startRun(exerciseId: string, name: string, nowMs: number): CardioRun {
  return { exerciseId, name, goAtMs: nowMs + COUNTDOWN_MS };
}

export function phaseOf(run: CardioRun, nowMs: number): CardioPhase {
  const left = run.goAtMs - nowMs;
  if (left > 0) return { phase: 'countdown', remaining: Math.ceil(left / 1000), fraction: Math.min(1, left / COUNTDOWN_MS) };
  return { phase: 'running', elapsedSeconds: Math.floor(Math.max(0, -left) / 1000) };
}

/** Uma corrida esquecida há mais de 12 h deixa de ser retomada. */
const STALE_MS = 12 * 3600 * 1000;

export function parseRun(raw: string | null, nowMs: number): CardioRun | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<CardioRun>;
    if (typeof r.exerciseId !== 'string' || typeof r.name !== 'string' || typeof r.goAtMs !== 'number') return null;
    if (nowMs - r.goAtMs > STALE_MS) return null;
    return { exerciseId: r.exerciseId, name: r.name, goAtMs: r.goAtMs };
  } catch {
    return null;
  }
}
