import type { ExerciseInput } from '../../data/models/exercise';
import { ids } from '../util/uuid';
import type { LibraryItem } from './library-types';

/** Converte um item da biblioteca nos dados de um exercício teu. */
export function libraryItemToInput(item: LibraryItem): ExerciseInput {
  return {
    id: ids.libraryExercise(item.key),
    name: item.name,
    kind: item.kind,
    category: item.category,
    metricType: item.metricType,
    isUnilateral: item.isUnilateral,
    isIsometric: item.isIsometric,
    region: item.region,
    movementType: item.movementType,
    equipmentId: item.equipment ? ids.equipment(item.equipment) : null,
    defaultRestSeconds: null,
    mechanic: item.kind === 'STRENGTH' ? item.mechanic : null,
    notes: item.variants ? `Variações: ${item.variants}` : null,
    primaryMuscleIds: item.primary.map((k) => ids.muscle(k)),
    secondaryMuscleIds: item.secondary.map((k) => ids.muscle(k)),
    mobilityAreaIds: item.mobilityAreas.map((k) => ids.mobilityArea(k)),
  };
}

export type LibraryItemState = 'available' | 'added' | 'archived';
