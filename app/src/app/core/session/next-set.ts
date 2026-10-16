import type { Kind, MetricType, Side } from '../../data/models/enums';
import type { SessionSet, SetGroup } from '../../data/models/session';
import type { LoadAction } from '../progression/load';

/**
 * A série seguinte de um exercício: os valores que a app propõe (no botão de um toque e na folha de registo)
 * e os passos dos botões − / +. Só UI: não decide dose de treino (isso é core/progression/load.ts).
 */

/** Valores de uma série num lado, nas unidades da base (kg, s, m, kcal). */
export interface SetValues {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  caloriesKcal: number | null;
}

export interface ExerciseTargets {
  targetWeightKg: number | null;
  targetReps: number | null;
  targetDurationSeconds: number | null;
  targetDistanceM: number | null;
}

/** Sugestão de carga para hoje (core/progression/load.ts), já com a opção escolhida. */
export interface TodaySuggestion {
  weightKg: number | null;
  repsMin: number;
  action: LoadAction;
}

export interface NextSetInput {
  sides: Side[];
  /** Séries já registadas hoje neste exercício. */
  today: SetGroup[];
  /** Séries da última sessão terminada com este exercício. */
  previous: SetGroup[];
  targets: ExerciseTargets;
  suggestion: TodaySuggestion | null;
}

export type NextSet = Partial<Record<Side, SetValues>>;

const EMPTY: SetValues = { weightKg: null, reps: null, durationSeconds: null, distanceM: null, caloriesKcal: null };

const valuesOf = (s: SessionSet): SetValues => ({
  weightKg: s.weightKg, reps: s.reps, durationSeconds: s.durationSeconds, distanceM: s.distanceM, caloriesKcal: s.caloriesKcal,
});

const fromTargets = (t: ExerciseTargets): SetValues | null => {
  const v = { ...EMPTY, weightKg: t.targetWeightKg, reps: t.targetReps, durationSeconds: t.targetDurationSeconds, distanceM: t.targetDistanceM };
  return v.weightKg === null && v.reps === null && v.durationSeconds === null && v.distanceM === null ? null : v;
};

const pick = (group: SetGroup | undefined, side: Side): SetValues | null => {
  if (!group) return null;
  const row = group.sets.find((s) => s.side === side) ?? group.sets[0];
  return row ? valuesOf(row) : null;
};

/**
 * Valores propostos para a próxima série de trabalho, por lado:
 * 1. Já há séries de trabalho hoje: repete a última (o mais comum entre séries).
 * 2. Senão, parte da primeira série de trabalho da última sessão, dos alvos do treino ou, por fim, do último aquecimento
 *    de hoje; com sugestão de carga, a carga é a sugerida e as repetições o mínimo da faixa (ou as de antes, se mantém).
 * A reserva (RIR) e a amplitude nunca se copiam: são de cada série.
 * Devolve {} quando não há nada de onde partir.
 */
export function nextSetValues(i: NextSetInput): NextSet {
  const out: NextSet = {};
  const lastWorking = [...i.today].reverse().find((g) => g.type === 'WORKING');
  if (lastWorking) {
    for (const side of i.sides) {
      const v = pick(lastWorking, side);
      if (v) out[side] = v;
    }
    return out;
  }
  const prevWorking = i.previous.find((g) => g.type === 'WORKING') ?? i.previous[0];
  const lastWarmup = i.today.at(-1);
  for (const side of i.sides) {
    let v = pick(prevWorking, side) ?? fromTargets(i.targets) ?? pick(lastWarmup, side);
    const sg = i.suggestion;
    if (sg && sg.weightKg !== null) {
      const base = v ?? EMPTY;
      v = { ...base, weightKg: sg.weightKg, reps: sg.action === 'hold' && base.reps ? base.reps : sg.repsMin };
    }
    if (v) out[side] = v;
  }
  return out;
}

/** O valor que define a série (repetições ou duração) está preenchido em todos os lados? */
export function isComplete(metric: MetricType, next: NextSet, sides: Side[]): boolean {
  return sides.every((side) => {
    const v = next[side];
    if (!v) return false;
    if (metric === 'DURATION') return !!v.durationSeconds && v.durationSeconds > 0;
    return !!v.reps && v.reps >= 1;
  });
}

/**
 * Pode registar-se com um só toque? Força e mobilidade, numa sessão em curso, com valores completos.
 * O cardio fica de fora: tem o ecrã da atividade ao vivo.
 */
export function canQuickLog(kind: Kind, metric: MetricType, next: NextSet, sides: Side[]): boolean {
  return kind !== 'CARDIO' && isComplete(metric, next, sides);
}

/** Incremento do − / + da carga: o do material (definição `loadIncrements`) ou 2,5 kg (rules.ts `load.increments`). */
export const DEFAULT_WEIGHT_STEP = 2.5;
export function weightStep(incrementKg: number | null | undefined): number {
  return incrementKg && incrementKg > 0 ? incrementKg : DEFAULT_WEIGHT_STEP;
}

/**
 * Um toque em − / +: soma `delta` e fica no múltiplo do passo mais próximo (60 + 2,5 = 62,5; 61 + 2,5 = 62,5),
 * nunca abaixo de `min`. Sem valor, o + começa no passo e o − em `min`.
 */
export function stepValue(value: number | null, delta: number, min = 0): number {
  const step = Math.abs(delta);
  if (value === null || !Number.isFinite(value)) return delta > 0 ? Math.max(min, step) : min;
  const onGrid = Math.abs(value / step - Math.round(value / step)) < 1e-9;
  const next = onGrid ? value + delta : delta > 0 ? Math.ceil(value / step) * step : Math.floor(value / step) * step;
  return Math.max(min, Math.round(next * 1000) / 1000);
}
