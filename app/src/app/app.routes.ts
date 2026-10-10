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
    path: 'exercicios/:id/historico',
    loadComponent: () => import('./features/history/exercise-history.page').then((m) => m.ExerciseHistoryPage),
  },
  {
    path: 'exercicios/:id',
    loadComponent: () => import('./features/exercises/exercise-form.page').then((m) => m.ExerciseFormPage),
  },
  {
    path: 'definicoes',
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: 'definicoes/relogio', loadComponent: () => import('./features/watch/watch-setup.page').then((m) => m.WatchSetupPage) },
  { path: 'bem-vindo', loadComponent: () => import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage) },
  { path: 'mais', loadComponent: () => import('./features/more/more.page').then((m) => m.MorePage) },
  { path: 'treinos', loadComponent: () => import('./features/workouts/workouts.page').then((m) => m.WorkoutsPage) },
  {
    path: 'treinos/novo',
    loadComponent: () => import('./features/workouts/workout-editor.page').then((m) => m.WorkoutEditorPage),
  },
  {
    path: 'treinos/:id',
    loadComponent: () => import('./features/workouts/workout-editor.page').then((m) => m.WorkoutEditorPage),
  },
  { path: 'sessao', loadComponent: () => import('./features/session/session.page').then((m) => m.SessionPage) },
  { path: 'planeados', loadComponent: () => import('./features/planned/planned.page').then((m) => m.PlannedPage) },
  { path: 'historico', loadComponent: () => import('./features/history/history.page').then((m) => m.HistoryPage) },
  { path: 'historico/:id', loadComponent: () => import('./features/session/session.page').then((m) => m.SessionPage) },
  { path: 'graficos', ...placeholder('Gráficos', 'Fase 4', 'Volume, séries por músculo, mobilidade.') },
  { path: 'perfil', loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage) },
  { path: '**', redirectTo: 'home' },
];
