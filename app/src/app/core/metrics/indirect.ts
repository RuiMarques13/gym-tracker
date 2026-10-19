import type { MetricExercise } from './volume';

/**
 * Quanto conta uma série para cada músculo de um exercício (volume semanal e recuperação).
 * - Principal: 1. Secundário: o peso por defeito (0,5; definição «Peso das séries em músculos secundários»).
 *   Estudo: Pelland et al. 2026, contar as séries indiretas como 0,5 foi o que melhor previu os ganhos.
 * - Exceções por exercício, só onde há estudo de crescimento do músculo (rules.ts, `volume.indirect.squat`).
 * O mapa de músculos não muda: um músculo com peso 0 continua a aparecer como «apoio» (está ativo, não cresce).
 * Estudo completo: «Estudo — volume indireto (músculos secundários)» no projeto.
 */

export interface IndirectOverride {
  /** Regra em rules.ts com a fonte. */
  rule: string;
  /** Nome normalizado (minúsculas, sem acentos) do exercício. */
  match: RegExp;
  /** Nomes que casam com `match` mas ficam de fora. */
  except?: RegExp;
  muscle: string;
  weight: number;
}

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Agachamentos bilaterais com barra, halteres, kettlebell ou peso corporal (não máquinas, não unilaterais, não saltos). */
const SQUAT = /\b(squats?|agachamento)\b/;
const NOT_BILATERAL_FREE_SQUAT =
  /split|bulgar|lunge|afundo|pistol|shrimp|single-leg|one leg|one-arm|unilateral|sissy|jump|salto|jerk|get-up|kneeling|frankenstein|jefferson|hack|pendulum|v-squat|belt|leg press|lying machine|sumo|plie|side split|spanish|step/;
/** Agachamento completo pelo nome (abaixo da paralela). */
const FULL_DEPTH = /full squat|olympic squat|deep squat|\batg\b|ass to grass|agachamento completo|agachamento profundo/;

export const INDIRECT_OVERRIDES: readonly IndirectOverride[] = [
  // Kubo 2019 (agachamento com barra, completo e meio): isquiotibiais sem alteração de volume em RM.
  { rule: 'volume.indirect.squat', match: SQUAT, except: NOT_BILATERAL_FREE_SQUAT, muscle: 'isquiotibiais', weight: 0 },
  // Kubo 2019: no completo, o adutor magno cresceu mais que o quadríceps (+6,2% contra +4,9%); no meio, cerca de metade.
  { rule: 'volume.indirect.squat', match: FULL_DEPTH, except: NOT_BILATERAL_FREE_SQUAT, muscle: 'adutores', weight: 1 },
];

/** Exceção que se aplica a este exercício e músculo, ou null. */
export function overrideFor(exerciseName: string | undefined, muscle: string): IndirectOverride | null {
  if (!exerciseName) return null;
  const n = norm(exerciseName);
  return INDIRECT_OVERRIDES.find((o) => o.muscle === muscle && o.match.test(n) && !(o.except?.test(n) ?? false)) ?? null;
}

/**
 * Peso de uma série para cada músculo do exercício. Principais 1; secundários `secondaryWeight`, salvo exceção.
 * Músculos com peso 0 ficam de fora do resultado.
 */
export function muscleWeights(ex: MetricExercise, secondaryWeight: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of ex.primaryMuscles) out.set(m, 1);
  for (const m of ex.secondaryMuscles) {
    if (out.has(m)) continue;
    const w = overrideFor(ex.name, m)?.weight ?? secondaryWeight;
    if (w > 0) out.set(m, w);
  }
  return out;
}
