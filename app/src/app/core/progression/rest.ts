import type { Mechanic } from '../../data/models/enums';

/**
 * Descanso sugerido pelo tipo de exercício (IUSCA 2021: pelo menos 2 min em multiarticulares, 60–90 s em
 * monoarticulares e máquinas). Escolha da app dentro dessas faixas: 120 s e 90 s. Ver rules.ts, `rest.byMechanic`.
 */
export const REST_BY_MECHANIC: Record<Mechanic, number> = { COMPOUND: 120, ISOLATION: 90 };

/** Descanso quando nem o treino nem o exercício o definem: pelo tipo (se ligado e conhecido) ou o global. */
export function defaultRest(mechanic: Mechanic | null, byMechanic: boolean, globalSeconds: number): number {
  return byMechanic && mechanic ? REST_BY_MECHANIC[mechanic] : globalSeconds;
}
