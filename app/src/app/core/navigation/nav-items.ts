export interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** Aparece na barra de separadores do telemóvel. */
  tab?: boolean;
}

/** Lista única de ecrãs: alimenta o menu lateral (PC), os separadores e o ecrã «Mais». */
export const NAV_ITEMS: NavItem[] = [
  { path: '/home', label: 'Home', icon: 'home-outline', tab: true },
  { path: '/planeados', label: 'Planeados', icon: 'calendar-outline' },
  { path: '/treinos', label: 'Treinos', icon: 'clipboard-outline', tab: true },
  { path: '/exercicios', label: 'Exercícios', icon: 'barbell-outline', tab: true },
  { path: '/historico', label: 'Histórico', icon: 'time-outline', tab: true },
  { path: '/graficos', label: 'Gráficos', icon: 'stats-chart-outline' },
  { path: '/perfil', label: 'Perfil', icon: 'person-outline' },
  { path: '/definicoes', label: 'Definições', icon: 'settings-outline' },
];
