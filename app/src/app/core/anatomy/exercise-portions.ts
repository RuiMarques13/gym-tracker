/** Ponte entre exercícios guardados (ids de músculos e equipamento) e o perfil por porções. */
import { ids } from '../util/uuid';
import { PORTIONS_OF_KEY, type PortionId } from './portions';
import { portionsFor, type PortionInfo, type PortionProfile } from './profiles';

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

/** Porção → grupos guardados que a contêm (ex.: triceps_medial → triceps). */
const KEYS_OF_PORTION = new Map<PortionId, string[]>();
for (const [key, ps] of Object.entries(PORTIONS_OF_KEY)) {
  for (const p of ps) KEYS_OF_PORTION.set(p, [...(KEYS_OF_PORTION.get(p) ?? []), key]);
}

/**
 * Boneco de um exercício guardado. A regra pela família do nome diz QUE porções de cada grupo trabalham
 * (ex.: no supino, a cabeça medial do tríceps) e com que fonte; os músculos que escolheste dizem QUAIS grupos
 * entram e com que papel. Assim, tirar um músculo tira-o do boneco e trocar principal/secundário muda a cor.
 * Porções que não pertencem a nenhum grupo escolhível ficam como a regra diz.
 */
export function portionsForExercise(ex: StoredExerciseLike): PortionProfile {
  const primaryKeys = muscleKeysOf(ex.primaryMuscleIds);
  const secondaryKeys = muscleKeysOf(ex.secondaryMuscleIds);
  const base = portionsFor({ name: ex.name, equipment: equipmentKeyOf(ex.equipmentId), primaryKeys, secondaryKeys, kind: ex.kind });
  const primary = new Set(primaryKeys);
  const secondary = new Set(secondaryKeys);
  const info: PortionProfile['info'] = {};
  for (const [id, inf] of Object.entries(base.info) as [PortionId, PortionInfo][]) {
    const keys = KEYS_OF_PORTION.get(id);
    if (!keys?.length) {
      info[id] = inf;
      continue;
    }
    if (keys.some((k) => primary.has(k))) info[id] = { ...inf, role: 'primary' };
    else if (keys.some((k) => secondary.has(k))) info[id] = { ...inf, role: 'secondary' };
    // nenhum dos grupos desta porção foi escolhido: sai do boneco
  }
  const ids = Object.keys(info) as PortionId[];
  return {
    primary: ids.filter((id) => info[id]!.role === 'primary'),
    secondary: ids.filter((id) => info[id]!.role === 'secondary'),
    info,
    family: base.family,
  };
}
