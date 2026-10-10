import type { Kind, MetricType, MovementType, Region } from '../../data/models/enums';

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
}
