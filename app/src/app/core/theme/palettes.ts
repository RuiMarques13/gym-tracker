/**
 * Paletas de cor da app. As cores vivem em src/styles.scss (atributo data-palette no <html>); aqui ficam os nomes,
 * a descrição e as amostras para o ecrã de Definições.
 */
export type PaletteId = 'esmeralda' | 'eletrico' | 'brasa';

export interface PaletteInfo {
  id: PaletteId;
  name: string;
  tagline: string;
  /** Principal, secundária e terciária no tema claro e no escuro (só para a amostra). */
  light: [string, string, string];
  dark: [string, string, string];
}

export const DEFAULT_PALETTE: PaletteId = 'esmeralda';

export const PALETTES: readonly PaletteInfo[] = [
  {
    id: 'esmeralda', name: 'Esmeralda', tagline: 'Verde fresco e ciano: foco e recuperação.',
    light: ['#047857', '#0e7490', '#7c3aed'], dark: ['#34d399', '#22d3ee', '#a78bfa'],
  },
  {
    id: 'eletrico', name: 'Elétrico', tagline: 'Índigo vivo com lima: energia de treino.',
    light: ['#4f46e5', '#4d7c0f', '#c026d3'], dark: ['#818cf8', '#bef264', '#e879f9'],
  },
  {
    id: 'brasa', name: 'Brasa', tagline: 'Laranja queimado e rosa: intensidade.',
    light: ['#c2410c', '#be123c', '#a16207'], dark: ['#fb923c', '#fb7185', '#fcd34d'],
  },
];

export function isPaletteId(v: unknown): v is PaletteId {
  return PALETTES.some((p) => p.id === v);
}
