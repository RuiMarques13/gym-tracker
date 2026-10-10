import type { Block, Kind, MetricType, SetType, Side } from './enums';

/** Uma linha de série. Nos unilaterais, LEFT e RIGHT da mesma série partilham `position`. */
export interface SessionSet {
  id: string;
  position: number;
  type: SetType;
  side: Side;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  caloriesKcal: number | null;
  rpe: number | null;
  /** Repetições em reserva, 0–4 (4 = «4 ou mais»); null = não registado. */
  rir: number | null;
  romScore: number | null;
  restSecondsActual: number | null;
  completedAt: string | null;
}

/** Uma série como o utilizador a vê: 1 entrada (BOTH) ou até 2 (LEFT/RIGHT). */
export interface SetGroup {
  position: number;
  type: SetType;
  sets: SessionSet[];
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  kind: Kind;
  metricType: MetricType;
  isUnilateral: boolean;
  block: Block;
  position: number;
  supersetGroup: string | null;
  targetSets: number | null;
  targetReps: number | null;
  targetDurationSeconds: number | null;
  targetWeightKg: number | null;
  targetDistanceM: number | null;
  /** Descanso do treino (snapshot) ou, na falta dele, o do exercício. null = usar o global. */
  restSeconds: number | null;
  notes: string | null;
  sets: SessionSet[];
}

export interface Session {
  id: string;
  templateId: string | null;
  templateName: string | null;
  scheduledId: string | null;
  startedAt: string;
  endedAt: string | null;
  pausedSeconds: number;
  rpe: number | null;
  notes: string | null;
  /** Última série registada (ou null): serve para propor o fim de uma sessão esquecida. */
  lastActivityAt: string | null;
  exercises: SessionExercise[];
}

/** Linha da lista do histórico. */
export interface SessionSummary {
  id: string;
  templateName: string | null;
  startedAt: string;
  endedAt: string;
  exerciseCount: number;
  setCount: number;
  /** Σ carga × reps das séries de trabalho (os dois lados nos unilaterais). */
  volumeKg: number;
  rpe: number | null;
  notes: string | null;
}

/** O que fizeste num exercício numa sessão. */
export interface ExerciseHistoryEntry {
  sessionId: string;
  sessionExerciseId: string;
  startedAt: string;
  templateName: string | null;
  kind: Kind;
  metricType: MetricType;
  isUnilateral: boolean;
  sets: SessionSet[];
}

/** Valores de um lado de uma série. */
export interface SideEntry {
  side: Side;
  weightKg?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  caloriesKcal?: number | null;
  rpe?: number | null;
  rir?: number | null;
  romScore?: number | null;
}

export interface SetInput {
  sessionExerciseId: string;
  /** Omitido = nova série no fim. Indicado = edita essa série. */
  position?: number;
  type?: SetType;
  entries: SideEntry[];
}

export interface FinishInput {
  rpe?: number | null;
  notes?: string | null;
  /** Por defeito, agora. Serve para terminar uma sessão esquecida na última série registada. */
  endedAt?: string;
}

export interface SessionDetailsInput {
  rpe?: number | null;
  notes?: string | null;
}

export class SessionError extends Error {
  constructor(
    readonly code: 'active' | 'not-found' | 'ended' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

/** Agrupa as linhas por série (position), por ordem. */
export function groupSets(sets: SessionSet[]): SetGroup[] {
  const map = new Map<number, SessionSet[]>();
  for (const s of sets) map.set(s.position, [...(map.get(s.position) ?? []), s]);
  const sideOrder: Record<Side, number> = { BOTH: 0, LEFT: 1, RIGHT: 2 };
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([position, rows]) => ({
      position,
      type: rows[0].type,
      sets: rows.sort((a, b) => sideOrder[a.side] - sideOrder[b.side]),
    }));
}

/** Séries de trabalho concluídas (as de aquecimento não contam para o objetivo). */
export function workingSetCount(ex: SessionExercise): number {
  return groupSets(ex.sets).filter((g) => g.type === 'WORKING').length;
}
