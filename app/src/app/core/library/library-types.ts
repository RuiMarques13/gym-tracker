import type { Category, Kind, MetricType, MovementType, Region } from '../../data/models/enums';

/** Biblioteca de exercícios: só consulta. Um item passa a exercício teu quando o adicionas. */
export interface LibraryData {
  version: number;
  groups: { key: string; label: string }[];
  items: LibraryItem[];
}

export interface LibraryItem {
  /** Chave estável (nome + equipamento). O ID do exercício adicionado deriva dela. */
  key: string;
  name: string;
  group: string;
  kind: Kind;
  category: Category;
  metricType: MetricType;
  isUnilateral: boolean;
  isIsometric: boolean;
  region: Region | null;
  movementType: MovementType | null;
  /** Chave do equipamento (ver catalog.json); null = sem equipamento. */
  equipment: string | null;
  primary: string[];
  secondary: string[];
  /** Chaves das áreas de mobilidade (só exercícios de mobilidade). */
  mobilityAreas: string[];
  /** Variantes do catálogo (pega, inclinação…), guardadas nas notas ao adicionar. */
  variants: string | null;
  /** Nome em português (itens do teu catálogo); null nos que vieram só do free-exercise-db. */
  namePt: string | null;
  /** De onde veio: o teu catálogo ou o free-exercise-db (domínio público). */
  source: 'catalog' | 'fedb';
  /** Id no free-exercise-db, quando o item existe lá. */
  fedbId?: string;
  /** Multiarticular ou monoarticular (free-exercise-db); null quando não se sabe. */
  mechanic: 'COMPOUND' | 'ISOLATION' | null;
  /** Nível indicado no free-exercise-db. */
  level: 'beginner' | 'intermediate' | 'expert' | null;
}

/** Nome para regras que só conhecem português (perfis musculares, animações): o PT quando existe. */
export const ruleName = (i: Pick<LibraryItem, 'name' | 'namePt'>): string => i.namePt ?? i.name;
