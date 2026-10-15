import type { Mechanic } from '../../data/models/enums';
import type { Goal, Level } from '../metrics/volume';

/**
 * O que cada objetivo muda (especificação «Progressão e ciclos», «Objetivos e corpo»). Ver rules.ts, `goal.*`.
 * - Hipertrofia: 8–12 repetições (ACSM 2009, A).
 * - Força: 8–12 no iniciante (ACSM 2009, A); 4–6 no intermédio e avançado (ACSM 2009 dá 1–6 RM no avançado;
 *   4–6 é escolha da app dentro dessa faixa); cerca de 80% do 1RM em 2–3 séries por exercício (ACSM 2026, comunicado);
 *   descanso 2–3 min nos principais (ACSM 2009, B).
 * - Potência: 3–6 repetições a 30–60% do 1RM (tronco superior; 0–60% no inferior), 1–3 séries, rápida (ACSM 2009, A);
 *   30–70% do 1RM, o mais rápido possível na subida (ACSM 2026, comunicado); descanso 2–3 min nos principais (D).
 * - Resistência muscular: carga leve, 10–15 repetições (ACSM 2009, A; resumo: 40–60% do 1RM); avançado 10–25 ou mais
 *   (C); descanso de menos de 1 min a 1–2 min (C).
 * - Definição e manutenção: mantém a faixa (8–12 por defeito; a app não guarda o objetivo anterior).
 */
export const GOAL_LABEL: Record<Goal, string> = {
  hypertrophy: 'Ganhar massa', strength: 'Força', power: 'Potência', endurance: 'Resistência muscular', maintenance: 'Manutenção', cut: 'Definição',
};

export function defaultRepRange(goal: Goal, level: Level): [number, number] {
  if (goal === 'strength' && level !== 'beginner') return [4, 6];
  if (goal === 'power') return [3, 6];
  if (goal === 'endurance') return level === 'advanced' ? [15, 25] : [10, 15];
  return [8, 12];
}

/** Objetivos que usam as faixas de volume da hipertrofia (nenhuma fonte dá séries por músculo para os outros). */
export const usesHypertrophyVolume = (g: Goal): boolean => g === 'hypertrophy' || g === 'strength' || g === 'power' || g === 'endurance';

/** Carga alvo pelo 1RM estimado, por objetivo; null quando o objetivo não define uma percentagem. */
export interface LoadTarget {
  label: string;
  lo: number;
  hi: number;
  /** Indicação de execução (a app não mede a velocidade). */
  cue: string | null;
  rule: string;
}
export function loadTarget(goal: Goal, e1rm: number, incrementKg: number | null): LoadTarget | null {
  const inc = incrementKg && incrementKg > 0 ? incrementKg : 0.5;
  const down = (x: number) => Math.floor(x / inc + 1e-9) * inc;
  const up = (x: number) => Math.ceil(x / inc - 1e-9) * inc;
  if (goal === 'strength') { const k = strengthTarget(e1rm, incrementKg); return { label: '~80% do 1RM', lo: k, hi: k, cue: null, rule: 'goal.strength.load' }; }
  if (goal === 'power') return { label: '30–70% do 1RM', lo: up(e1rm * 0.3), hi: down(e1rm * 0.7), cue: 'o mais rápido possível na subida', rule: 'goal.power.load' };
  if (goal === 'endurance') return { label: '40–60% do 1RM', lo: up(e1rm * 0.4), hi: down(e1rm * 0.6), cue: null, rule: 'goal.endurance.load' };
  return null;
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
  if (goal === 'endurance') return 60;
  if (mechanic === 'COMPOUND') return goal === 'strength' || goal === 'power' ? 180 : 120;
  return 90;
}
