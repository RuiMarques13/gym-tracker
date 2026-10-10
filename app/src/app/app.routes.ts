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
  { path: 'mais', redirectTo: 'home' },
  { path: 'definicoes/menu', loadComponent: () => import('./features/settings/menu-settings.page').then((m) => m.MenuSettingsPage) },
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
  { path: 'saude', loadComponent: () => import('./features/health/health.page').then((m) => m.HealthPage) },
  { path: 'saude/:id', loadComponent: () => import('./features/health/health-detail.page').then((m) => m.HealthDetailPage) },
  { path: 'fotos', loadComponent: () => import('./features/photos/photos.page').then((m) => m.PhotosPage) },
  { path: 'volume', loadComponent: () => import('./features/volume/volume.page').then((m) => m.VolumePage) },
  { path: 'graficos', loadComponent: () => import('./features/charts/charts.page').then((m) => m.ChartsPage) },
  { path: 'conta', loadComponent: () => import('./features/account/account.page').then((m) => m.AccountPage) },
  { path: 'perfil', loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage) },
  { path: '**', redirectTo: 'home' },
];
