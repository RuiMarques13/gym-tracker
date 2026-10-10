import { describe, expect, it } from 'vitest';
import { LIBRARY } from './library-data';
import { buildGroupLookup, groupOfExercise } from './exercise-group';
import { ids } from '../util/uuid';

const lookup = buildGroupLookup(LIBRARY);

describe('grupo de um exercício teu', () => {
  it('usa o grupo da biblioteca quando veio de lá', () => {
    const it = LIBRARY.items.find((i) => i.group === 'peito')!;
    expect(groupOfExercise({ id: ids.libraryExercise(it.key), kind: 'STRENGTH', primaryMuscleIds: [] }, lookup)).toBe('peito');
  });
  it('mobilidade e cardio têm grupo próprio', () => {
    expect(groupOfExercise({ id: 'x', kind: 'MOBILITY', primaryMuscleIds: [] }, lookup)).toBe('mobilidade');
    expect(groupOfExercise({ id: 'y', kind: 'CARDIO', primaryMuscleIds: [] }, lookup)).toBe('cardio');
  });
  it('exercício criado à mão cai no grupo do músculo principal', () => {
    expect(groupOfExercise({ id: 'z', kind: 'STRENGTH', primaryMuscleIds: [ids.muscle('chest')] }, lookup)).toBe('peito');
    expect(groupOfExercise({ id: 'w', kind: 'STRENGTH', primaryMuscleIds: [] }, lookup)).toBeNull();
  });
});
