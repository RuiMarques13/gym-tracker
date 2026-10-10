export interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** Não pode ser escondido do menu (garante sempre uma saída para as Definições). */
  locked?: boolean;
}

/** Lista única de ecrãs do menu lateral. A ordem aqui é a ordem por defeito. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/home', label: 'Home', icon: 'home-outline', locked: true },
  { path: '/treinos', label: 'Treinos', icon: 'clipboard-outline' },
  { path: '/exercicios', label: 'Exercícios', icon: 'barbell-outline' },
  { path: '/historico', label: 'Histórico', icon: 'time-outline' },
  { path: '/planeados', label: 'Planeados', icon: 'calendar-outline' },
  { path: '/graficos', label: 'Gráficos', icon: 'stats-chart-outline' },
  { path: '/definicoes', label: 'Definições', icon: 'settings-outline', locked: true },
];

/**
 * Aplica a personalização ao menu: `order` é a ordem escolhida (caminhos desconhecidos são ignorados;
 * ecrãs novos que ainda não estão na lista ficam no fim) e `hidden` os caminhos escondidos.
 * Os itens `locked` nunca se escondem.
 */
export function resolveNav(
  order: readonly string[],
  hidden: readonly string[],
  items: readonly NavItem[] = NAV_ITEMS,
): NavItem[] {
  const byPath = new Map(items.map((i) => [i.path, i]));
  const sorted: NavItem[] = [];
  for (const p of order) {
    const it = byPath.get(p);
    if (it && !sorted.includes(it)) sorted.push(it);
  }
  for (const it of items) if (!sorted.includes(it)) sorted.push(it);
  return sorted.filter((i) => i.locked || !hidden.includes(i.path));
}

/** Todos os itens, na ordem personalizada (inclui os escondidos), para o ecrã de personalização. */
export function orderedNav(order: readonly string[], items: readonly NavItem[] = NAV_ITEMS): NavItem[] {
  return resolveNav(order, [], items);
}
