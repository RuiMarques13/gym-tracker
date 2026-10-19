/**
 * Regras de volume semanal (spec «métricas de treino»). A origem de cada número está em core/progression/rules.ts:
 * - `volume.indirect` (0,5 por secundário): estudo, Pelland et al. (pré-publicação);
 * - `volume.effective`, `volume.hypertrophy`, `volume.rir`, `volume.perSession`: escolha da app dentro das fontes;
 * - `volume.advancedMax` (máximo 20): estudo, IUSCA 2021;
 * - `volume.maintenance`, `volume.cut`: escolha da app. A especificação citava Bickel 2011, Spiering 2021, Roth 2022 e
 *   Baz-Valle 2021, mas essas fontes não foram abertas; até serem verificadas não contam como estudo.
 * Orientação geral de treino, não aconselhamento médico.
 */
export interface VolumeRange {
  min: number;
  target: number;
  max: number;
  freq: [number, number];
  rir: [number, number];
}

export const VOLUME_RULES = {
  unit: 'fractional_sets_per_muscle_per_week',
  indirect_set_weight: 0.5,
  effective_set: { rir_max: 3, reps_min: 5, reps_max: 30 },
  max_direct_sets_per_session: 10,
  goals: {
    hypertrophy: {
      beginner: { min: 6, target: 10, max: 12, freq: [2, 2], rir: [2, 3] },
      intermediate: { min: 10, target: 14, max: 20, freq: [2, 3], rir: [1, 3] },
      // máximo 20: a IUSCA 2021 escreve que a evidência acima de 20 séries é limitada (era 25).
      advanced: { min: 12, target: 18, max: 20, freq: [2, 4], rir: [0, 2] },
    },
    maintenance: {
      under_60: { min: 3, target_ratio_of_previous: 0.33, max: 8, freq: [1, 2], rir: [1, 3] },
      '60_plus': { min: 4, target: 6, max: 10, freq: [2, 2], rir: [1, 3] },
    },
    cut: {
      any: {
        min: 10, target: 'previous_volume', max: 20, freq: [2, 3], rir: [1, 3],
        on_performance_drop_weeks: 2, volume_reduction: 0.25,
      },
    },
  },
} as const;

/** As regras, com o peso dos secundários editável (Definições). */
export type VolumeRules = Omit<typeof VOLUME_RULES, 'indirect_set_weight'> & { indirect_set_weight: number };

/** As regras com o peso dos secundários escolhido nas Definições (0 a 1; por defeito 0,5). */
export function rulesWithSecondaryWeight(weight: number): VolumeRules {
  return { ...VOLUME_RULES, indirect_set_weight: weight };
}
