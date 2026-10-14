import type { Mechanic } from '../../data/models/enums';
import type { Goal } from '../metrics/volume';
import { restByGoal } from './goals';

/**
 * Descanso sugerido pelo tipo de exercício (IUSCA 2021: pelo menos 2 min em multiarticulares, 60–90 s em
 * monoarticulares e máquinas). Escolha da app dentro dessas faixas: 120 s e 90 s; no objetivo Força, 180 s nos
 * multiarticulares (ACSM 2009: 2–3 min nos principais). Ver rules.ts, `rest.byMechanic` e `goal.strength.rest`.
 */
export const REST_BY_MECHANIC: Record<Mechanic, number> = { COMPOUND: 120, ISOLATION: 90 };

/** Descanso quando nem o treino nem o exercício o definem: pelo tipo (se ligado e conhecido) ou o global. */
export function defaultRest(mechanic: Mechanic | null, byMechanic: boolean, globalSeconds: number, goal: Goal = 'hypertrophy'): number {
  return byMechanic && mechanic ? restByGoal(mechanic, goal) : globalSeconds;
}
