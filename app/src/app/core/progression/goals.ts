import type { Mechanic } from '../../data/models/enums';
import type { Goal, Level } from '../metrics/volume';

/**
 * O que cada objetivo muda (especificação «Progressão e ciclos», «Objetivos e corpo»). Ver rules.ts, `goal.*`.
 * - Hipertrofia: 8–12 repetições (ACSM 2009, A).
 * - Força: 8–12 no iniciante (ACSM 2009, A); 4–6 no intermédio e avançado (ACSM 2009 dá 1–6 RM no avançado;
 *   4–6 é escolha da app dentro dessa faixa); cerca de 80% do 1RM em 2–3 séries por exercício (ACSM 2026, comunicado);
 *   descanso 2–3 min nos principais (ACSM 2009, B).
 * - Definição e manutenção: mantém a faixa (8–12 por defeito; a app não guarda o objetivo anterior).
 */
export const GOAL_LABEL: Record<Goal, string> = {
  hypertrophy: 'Ganhar massa', strength: 'Força', maintenance: 'Manutenção', cut: 'Definição',
};

export function defaultRepRange(goal: Goal, level: Level): [number, number] {
  if (goal === 'strength' && level !== 'beginner') return [4, 6];
  return [8, 12];
}

/** Séries por exercício por defeito ao juntar um exercício a um treino: 3 (na força, dentro das 2–3 do ACSM 2026). */
export const DEFAULT_SETS = 3;

/** Força: carga alvo ≈ 80% do 1RM estimado (ACSM 2026, comunicado), arredondada para baixo ao incremento. */
export const STRENGTH_LOAD = 0.8;
export function strengthTarget(e1rm: number, incrementKg: number | null): number {
  const raw = e1rm * STRENGTH_LOAD;
  const inc = incrementKg && incrementKg > 0 ? incrementKg : 0.5;
  return Math.floor(raw / inc + 1e-9) * inc;
}

/**
 * Descanso pelo tipo de exercício: 2 min (multiarticular) e 90 s (monoarticular), IUSCA 2021.
 * No objetivo Força, os principais (multiarticulares) descansam 3 min (ACSM 2009: 2–3 min; a app usa o topo).
 */
export function restByGoal(mechanic: Mechanic, goal: Goal): number {
  if (mechanic === 'COMPOUND') return goal === 'strength' ? 180 : 120;
  return 90;
}
