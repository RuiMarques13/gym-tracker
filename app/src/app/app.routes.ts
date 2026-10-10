import { Routes } from '@angular/router';

const placeholder = (title: string, phase: string, description: string) => ({
  loadComponent: () => import('./features/placeholder/placeholder.page').then((m) => m.PlaceholderPage),
  data: { title, phase, description },
});

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
  {
    path: 'exercicios',
    loadComponent: () => import('./features/exercises/exercises.page').then((m) => m.ExercisesPage),
  },
  {
    path: 'exercicios/biblioteca',
    loadComponent: () => import('./features/library/library.page').then((m) => m.LibraryPage),
  },
  {
    path: 'exercicios/novo',
    loadComponent: () => import('./features/exercises/exercise-form.page').then((m) => m.ExerciseFormPage),
  },
  {
    path: 'exercicios/:id',
    loadComponent: () => import('./features/exercises/exercise-form.page').then((m) => m.ExerciseFormPage),
  },
  {
    path: 'definicoes',
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: 'mais', loadComponent: () => import('./features/more/more.page').then((m) => m.MorePage) },
  { path: 'treinos', ...placeholder('Treinos', 'Fase 1.2', 'Criar, copiar e organizar treinos por blocos.') },
  { path: 'planeados', ...placeholder('Planeados', 'Fase 1.5', 'Calendário de treinos planeados.') },
  { path: 'historico', ...placeholder('Histórico', 'Fase 1.4', 'Sessões e séries registadas, com correções.') },
  { path: 'graficos', ...placeholder('Gráficos', 'Fase 4', 'Volume, séries por músculo, mobilidade.') },
  { path: 'perfil', ...placeholder('Perfil', 'Fase 1.5', 'Dados pessoais e medições corporais.') },
  { path: '**', redirectTo: 'home' },
];
