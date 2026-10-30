import { isEnabled, type Feature } from '../features';

/**
 * Navegação principal: 4 separadores em baixo (barra lateral estreita no PC) e, dentro de alguns,
 * secções num segmento no topo. Perfil, Conta e Definições abrem-se pelo avatar.
 * Lógica pura: recebe o URL, devolve o separador e a secção.
 */

export type TabId = 'hoje' | 'treinos' | 'exercicios' | 'progresso';

export interface Section {
  path: string;
  label: string;
  /** Só aparece com esta funcionalidade ligada (core/features.ts). */
  feature?: Feature;
}

export interface Tab {
  id: TabId;
  label: string;
  icon: string;
  /**
   * Secções do separador, pela ordem do segmento. A primeira é a raiz; um separador sem segmento tem uma só.
   * Os ecrãs de detalhe pertencem à secção cujo caminho os contém (`/treinos/123` → Treinos).
   */
  sections: Section[];
}

const ALL_TABS: Tab[] = [
  {
    id: 'hoje',
    label: 'Hoje',
    icon: 'home-outline',
    sections: [{ path: '/home', label: 'Hoje' }],
  },
  {
    id: 'treinos',
    label: 'Treinos',
    icon: 'clipboard-outline',
    sections: [
      { path: '/treinos', label: 'Treinos' },
      { path: '/planeados', label: 'Semana' },
      { path: '/ciclos', label: 'Ciclos' },
    ],
  },
  {
    id: 'exercicios',
    label: 'Exercícios',
    icon: 'barbell-outline',
    sections: [
      { path: '/exercicios', label: 'Os meus' },
      { path: '/exercicios/biblioteca', label: 'Biblioteca' },
    ],
  },
  {
    id: 'progresso',
    label: 'Progresso',
    icon: 'stats-chart-outline',
    sections: [
      { path: '/volume', label: 'Semana' },
      { path: '/historico', label: 'Histórico' },
      { path: '/graficos', label: 'Gráficos' },
      { path: '/fotos', label: 'Corpo' },
      { path: '/saude', label: 'Saúde', feature: 'watch' },
    ],
  },
];

/** Os separadores, sem as secções de funcionalidades escondidas. */
export const TABS: Tab[] = ALL_TABS.map((t) => ({ ...t, sections: t.sections.filter((s) => isEnabled(s.feature)) }));

/**
 * Caminhos onde a barra de separadores não aparece: treino em curso (modo foco) e introdução.
 * Sem sessão iniciada também não aparece (decide o shell, que conhece o estado da conta).
 */
const NO_TAB_BAR = ['/sessao', '/bem-vindo'];

/** Tira query, fragmento e a barra final: «/treinos/?x=1#a» → «/treinos». */
export function cleanPath(url: string): string {
  const p = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

function within(path: string, base: string): boolean {
  return path === base || path.startsWith(base + '/');
}

/** A secção (de qualquer separador) a que o URL pertence; a mais específica ganha. */
export function sectionForUrl(url: string, tabs: readonly Tab[] = TABS): { tab: Tab; section: Section } | null {
  const path = cleanPath(url);
  let best: { tab: Tab; section: Section } | null = null;
  for (const tab of tabs) {
    for (const section of tab.sections) {
      if (within(path, section.path) && (!best || section.path.length > best.section.path.length)) best = { tab, section };
    }
  }
  return best;
}

/** O separador ativo para o URL, ou null (Perfil, Definições, Conta…). */
export function tabForUrl(url: string, tabs: readonly Tab[] = TABS): Tab | null {
  return sectionForUrl(url, tabs)?.tab ?? null;
}

/** A barra de separadores aparece em todo o lado menos no treino em curso e na introdução. */
export function tabBarVisible(url: string): boolean {
  const path = cleanPath(url);
  return !NO_TAB_BAR.some((p) => within(path, p));
}

/**
 * Para onde vai um toque num separador.
 * - No separador já ativo: volta à raiz (primeira secção), como nas apps nativas.
 * - Noutro: a última secção que usaste lá (`remembered`), ou a raiz.
 */
export function tabTarget(tab: Tab, currentUrl: string, remembered: string | undefined): string {
  const root = tab.sections[0].path;
  if (tabForUrl(currentUrl)?.id === tab.id) return root;
  if (remembered && tab.sections.some((s) => s.path === remembered)) return remembered;
  return root;
}
