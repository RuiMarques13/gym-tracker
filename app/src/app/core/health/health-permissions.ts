/**
 * Os tipos de dados que a app lê do Health Connect, e só esses (RGPD: pedir apenas o necessário).
 * A app não escreve nada no Health Connect.
 *
 * Cada tipo do plugin @capgo/capacitor-health corresponde a uma permissão do Android. O AndroidManifest retira
 * todas as outras que o plugin declara; o teste health-permissions.test.ts verifica que as duas listas batem certo.
 */
export const HEALTH_READ = ['heartRate', 'calories', 'totalCalories', 'basalCalories', 'steps', 'distance', 'vo2Max', 'workouts'] as const;

export type HealthReadType = (typeof HEALTH_READ)[number];

/** Permissão do Health Connect usada por cada tipo (ver HealthDataType.kt do plugin). */
export const HEALTH_PERMISSION: Record<HealthReadType, string> = {
  heartRate: 'android.permission.health.READ_HEART_RATE',
  calories: 'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  totalCalories: 'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  basalCalories: 'android.permission.health.READ_BASAL_METABOLIC_RATE',
  steps: 'android.permission.health.READ_STEPS',
  distance: 'android.permission.health.READ_DISTANCE',
  vo2Max: 'android.permission.health.READ_VO2_MAX',
  workouts: 'android.permission.health.READ_EXERCISE',
};
