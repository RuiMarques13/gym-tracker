import { v4, v5 } from 'uuid';

/**
 * Namespace fixo da app para UUID v5. Nunca mudar: todos os IDs
 * determinísticos (seed, ligações, settings) dependem dele.
 */
export const APP_NAMESPACE = '6b1f2c4e-9a7d-5e3b-8c21-0f4d9e7a3b55';

/** UUID aleatório para linhas criadas pelo utilizador. */
export function newId(): string {
  return v4();
}

/**
 * UUID determinístico a partir de uma chave estável.
 * Dois dispositivos que geram a mesma chave obtêm o mesmo ID,
 * por isso seed, sync e import não duplicam.
 */
export function stableId(key: string): string {
  return v5(key, APP_NAMESPACE);
}

/** IDs determinísticos por tipo de entidade (chaves documentadas em docs/ids.md). */
export const ids = {
  exercise: (name: string) => stableId(`exercise:${name.trim()}`),
  /** Exercício adicionado da biblioteca: o mesmo item dá o mesmo id em qualquer dispositivo. */
  libraryExercise: (libraryKey: string) => stableId(`library:${libraryKey}`),
  equipment: (key: string) => stableId(`equipment:${key}`),
  muscle: (key: string) => stableId(`muscle:${key}`),
  mobilityArea: (key: string) => stableId(`mobility_area:${key}`),
  exerciseMuscle: (exerciseId: string, muscleId: string) =>
    stableId(`exercise_muscle:${exerciseId}:${muscleId}`),
  exerciseMobilityArea: (exerciseId: string, areaId: string) =>
    stableId(`exercise_mobility_area:${exerciseId}:${areaId}`),
  /** Um registo de recuperação por dia e músculo. */
  muscleRecovery: (date: string, muscle: string) => stableId(`muscle_recovery:${date}:${muscle}`),
  /** Uma resposta por sugestão, episódio e tipo de resposta. */
  suggestion: (kind: string, exerciseId: string | null, episode: string, response: string | null) =>
    stableId(`suggestion:${kind}:${exerciseId ?? ''}:${episode}:${response ?? ''}`),
  /** Treino planeado por um ciclo: o mesmo ciclo, dia e treino dão o mesmo id em qualquer dispositivo. */
  cycleScheduled: (cycleId: string, date: string, templateId: string) => stableId(`cycle_scheduled:${cycleId}:${date}:${templateId}`),
  setting: (scope: string, scopeRef: string | null, key: string) =>
    stableId(`setting:${scope}:${scopeRef ?? ''}:${key}`),
};
