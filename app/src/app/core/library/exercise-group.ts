import { ids } from '../util/uuid';
import type { LibraryData } from './library-types';

export interface GroupLookup {
  /** id do exercício vindo da biblioteca → grupo. */
  byExerciseId: Map<string, string>;
  /** chave do músculo principal → grupo mais comum na biblioteca (para exercícios teus, criados à mão). */
  byMuscleId: Map<string, string>;
}

/** Constrói as tabelas que ligam os teus exercícios aos grupos da biblioteca. */
export function buildGroupLookup(lib: LibraryData): GroupLookup {
  const byExerciseId = new Map<string, string>();
  const tally = new Map<string, Map<string, number>>();
  for (const it of lib.items) {
    byExerciseId.set(ids.libraryExercise(it.key), it.group);
    const m = it.primary[0];
    if (it.kind !== 'STRENGTH' || !m) continue;
    const c = tally.get(m) ?? new Map<string, number>();
    c.set(it.group, (c.get(it.group) ?? 0) + 1);
    tally.set(m, c);
  }
  const byMuscleId = new Map<string, string>();
  for (const [m, c] of tally) byMuscleId.set(ids.muscle(m), [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return { byExerciseId, byMuscleId };
}

/** Grupo da biblioteca a que um exercício teu pertence (null se não der para saber). */
export function groupOfExercise(
  e: { id: string; kind: string; primaryMuscleIds: readonly string[] },
  lookup: GroupLookup,
): string | null {
  const known = lookup.byExerciseId.get(e.id);
  if (known) return known;
  if (e.kind === 'MOBILITY') return 'mobilidade';
  if (e.kind === 'CARDIO') return 'cardio';
  for (const m of e.primaryMuscleIds) {
    const g = lookup.byMuscleId.get(m);
    if (g) return g;
  }
  return null;
}
