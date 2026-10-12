import { activeMet, estimateActiveKcal, RECOVERY_MET, type BodyProfile, type Segment } from '../health/calories';
import { groupSets, type Session, type SessionExercise } from '../../data/models/session';

/** Segundos por repetição quando não há duração medida (cadência normal ≈ 2 s a subir/descer + pausa). */
export const SECONDS_PER_REP = 3.5;

export interface SessionStats {
  /** Duração total sem pausas, em segundos. */
  totalSeconds: number;
  /** Tempo a trabalhar: duração das séries (medida ou estimada pelas repetições). */
  activeSeconds: number;
  /** O resto: descanso entre séries, preparação e trocas de exercício. */
  restSeconds: number;
  sets: number;
  exercises: number;
  /** Σ carga × reps das séries de trabalho de força. */
  volumeKg: number;
  distanceM: number;
  /** Calorias que escreveste à mão no cardio, se alguma. */
  loggedKcal: number | null;
  /** Estimativa por MET/FC, ou null se falta o peso. */
  estimatedKcal: number | null;
  estimateBasis: 'heart-rate' | 'met' | null;
}

function setSeconds(ex: SessionExercise, durationSeconds: number | null, reps: number | null): number {
  if (durationSeconds && durationSeconds > 0) return durationSeconds;
  if (ex.kind === 'STRENGTH' && reps && reps > 0) return reps * SECONDS_PER_REP;
  return 0;
}

/** Números de uma sessão (em curso ou terminada). `nowMs` só conta se a sessão ainda não terminou. */
export function sessionStats(s: Session, nowMs: number, body: BodyProfile, avgHr: number | null = null): SessionStats {
  const end = s.endedAt ? Date.parse(s.endedAt) : nowMs;
  const totalSeconds = Math.max(0, Math.round((end - Date.parse(s.startedAt)) / 1000 - s.pausedSeconds));

  let activeSeconds = 0, sets = 0, volumeKg = 0, distanceM = 0, logged = 0, anyLogged = false;
  const segments: Segment[] = [];
  for (const ex of s.exercises) {
    for (const g of groupSets(ex.sets)) {
      sets++;
      let seconds = 0;
      for (const x of g.sets) {
        seconds += setSeconds(ex, x.durationSeconds, x.reps);
        distanceM += x.distanceM ?? 0;
        if (x.caloriesKcal) { logged += x.caloriesKcal; anyLogged = true; }
        if (ex.kind === 'STRENGTH' && g.type === 'WORKING') volumeKg += (x.weightKg ?? 0) * (x.reps ?? 0);
      }
      const dist = g.sets.reduce((n, x) => n + (x.distanceM ?? 0), 0);
      const speedKmh = ex.kind === 'CARDIO' && dist > 0 && seconds > 0 ? dist / 1000 / (seconds / 3600) : null;
      activeSeconds += seconds;
      segments.push({ seconds, met: activeMet({ kind: ex.kind, name: ex.exerciseName, speedKmh }) });
    }
  }
  activeSeconds = Math.min(activeSeconds, totalSeconds);
  const restSeconds = Math.max(0, totalSeconds - activeSeconds);
  segments.push({ seconds: restSeconds, met: RECOVERY_MET });

  const est = estimateActiveKcal({ body, totalSeconds, avgHr, segments });
  return {
    totalSeconds, activeSeconds, restSeconds, sets, exercises: s.exercises.length,
    volumeKg: Math.round(volumeKg), distanceM: Math.round(distanceM),
    loggedKcal: anyLogged ? Math.round(logged) : null,
    estimatedKcal: est?.kcal ?? null, estimateBasis: est?.basis ?? null,
  };
}

/** Velocidade média em km/h (ou null) e ritmo em min/km. */
export function paceOf(distanceM: number, seconds: number): { kmh: number; minPerKm: number } | null {
  if (distanceM <= 0 || seconds <= 0) return null;
  const kmh = distanceM / 1000 / (seconds / 3600);
  return { kmh, minPerKm: 60 / kmh };
}
