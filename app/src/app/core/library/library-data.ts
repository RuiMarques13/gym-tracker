import { LIBRARY_RAW } from './library.generated';
import type { LibraryData } from './library-types';
import { refineMuscles } from './muscle-refine';

/** Biblioteca com os músculos já divididos em finos (ver muscle-refine.ts). */
export const LIBRARY: LibraryData = {
  ...LIBRARY_RAW,
  items: LIBRARY_RAW.items.map((i) => ({ ...i, ...refineMuscles(i.name, { primary: i.primary, secondary: i.secondary }) })),
};
