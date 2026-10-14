import { LIBRARY_RAW } from './library.generated';
import { ruleName, type LibraryData, type LibraryItem } from './library-types';
import { profileFor } from './exercise-profile';
import { refineMuscles } from './muscle-refine';

function curate(i: LibraryItem): LibraryItem {
  // Os perfis curados conhecem os nomes do teu catálogo (em português); os do free-exercise-db trazem os músculos.
  const prof = i.kind === 'STRENGTH' && i.source === 'catalog' ? profileFor(ruleName(i)) : null;
  if (prof) return { ...i, ...prof };
  return { ...i, ...refineMuscles(ruleName(i), { primary: i.primary, secondary: i.secondary }) };
}

/** Biblioteca com perfil muscular curado (exercise-profile.ts) e músculos finos (muscle-refine.ts). */
export const LIBRARY: LibraryData = { ...LIBRARY_RAW, items: LIBRARY_RAW.items.map(curate) };
