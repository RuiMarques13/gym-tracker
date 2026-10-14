/**
 * Uma única fórmula de 1RM estimado para toda a app: Epley, peso × (1 + repetições / 30).
 *
 * Fontes (ver core/progression/rules.ts, chave `e1rm`):
 * - Reynolds, Gordon e Robergs 2006 (JSCR 20(3)): a previsão a partir de 5RM foi a mais exata e piorou com 10 e 20RM;
 *   «no more than 10 repetitions should be used»; Epley ficou entre as equações com menores resíduos a 5RM.
 * - Lacio et al. 2010 (Motricidade 6(3)): no supino, com 4–10RM, as equações (Epley e Brzycki incluídas) não diferiram
 *   do 1RM medido (r² 0,94–0,96).
 *
 * Escolha da app: as repetições em reserva (RIR) somam-se às feitas, como se a série fosse até à falha.
 */
export const E1RM_MAX_REPS = 10;

/** 1RM estimado; `reps` já com o RIR somado se o quiseres. null sem carga ou sem repetições. */
export function estimate1RM(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || weightKg <= 0 || !reps || reps < 1) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/**
 * 1RM estimado só dentro da janela onde as fontes o validaram (até 10 repetições, contando as de reserva).
 * Usado em decisões (tendência de desempenho, estagnação); os gráficos usam `estimate1RM` sem limite.
 */
export function reliable1RM(weightKg: number | null, reps: number | null, rir: number | null = null): number | null {
  if (reps === null) return null;
  const total = reps + (rir ?? 0);
  if (total > E1RM_MAX_REPS) return null;
  return estimate1RM(weightKg, total);
}
