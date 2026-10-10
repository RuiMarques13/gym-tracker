import { LIBRARY_RAW } from './library.generated';
import type { LibraryData, LibraryItem } from './library-types';
import { profileFor } from './exercise-profile';
import { refineMuscles } from './muscle-refine';

function curate(i: LibraryItem): LibraryItem {
  const prof = i.kind === 'STRENGTH' ? profileFor(i.name) : null;
  if (prof) return { ...i, ...prof };
  return { ...i, ...refineMuscles(i.name, { primary: i.primary, secondary: i.secondary }) };
}

/** Biblioteca com perfil muscular curado (exercise-profile.ts) e músculos finos (muscle-refine.ts). */
export const LIBRARY: LibraryData = { ...LIBRARY_RAW, items: LIBRARY_RAW.items.map(curate) };
