import type { ExerciseInput } from '../../data/models/exercise';
import { ids } from '../util/uuid';
import type { LibraryItem } from './library-types';

/** Converte um item da biblioteca nos dados de um exercício teu. */
export function libraryItemToInput(item: LibraryItem): ExerciseInput {
  return {
    id: ids.libraryExercise(item.key),
    name: item.name,
    kind: item.kind,
    metricType: item.metricType,
    isUnilateral: item.isUnilateral,
    isIsometric: item.isIsometric,
    region: item.region,
    movementType: item.movementType,
    equipmentId: ids.equipment(item.equipment),
    defaultRestSeconds: null,
    notes: item.variants ? `Variações: ${item.variants}` : null,
    primaryMuscleIds: item.primary.map((k) => ids.muscle(k)),
    secondaryMuscleIds: item.secondary.map((k) => ids.muscle(k)),
    mobilityAreaIds: [],
  };
}

export type LibraryItemState = 'available' | 'added' | 'archived';
