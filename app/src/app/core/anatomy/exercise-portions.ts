/** Ponte entre exercícios guardados (ids de músculos e equipamento) e o perfil por porções. */
import { ids } from '../util/uuid';
import { PORTIONS_OF_KEY } from './portions';
import { portionsFor, type PortionProfile } from './profiles';

const EQUIPMENT_KEYS = ['machine', 'cable', 'dumbbell', 'barbell', 'bodyweight', 'band', 'kettlebell', 'other'];
const KEY_OF_MUSCLE_ID = new Map(Object.keys(PORTIONS_OF_KEY).map((k) => [ids.muscle(k), k]));
const KEY_OF_EQUIPMENT_ID = new Map(EQUIPMENT_KEYS.map((k) => [ids.equipment(k), k]));

export const muscleKeysOf = (muscleIds: readonly string[]): string[] =>
  muscleIds.map((id) => KEY_OF_MUSCLE_ID.get(id)).filter((k): k is string => !!k);

export const equipmentKeyOf = (equipmentId: string | null): string | null =>
  (equipmentId && KEY_OF_EQUIPMENT_ID.get(equipmentId)) || null;

export interface StoredExerciseLike {
  name: string;
  kind: string;
  equipmentId: string | null;
  primaryMuscleIds: readonly string[];
  secondaryMuscleIds: readonly string[];
}

export function portionsForExercise(ex: StoredExerciseLike): PortionProfile {
  return portionsFor({
    name: ex.name,
    equipment: equipmentKeyOf(ex.equipmentId),
    primaryKeys: muscleKeysOf(ex.primaryMuscleIds),
    secondaryKeys: muscleKeysOf(ex.secondaryMuscleIds),
    kind: ex.kind,
  });
}
