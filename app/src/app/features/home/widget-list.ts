export const WIDGETS = [
  { id: 'next-workout', label: 'Próximo treino' },
  { id: 'week-summary', label: 'Resumo da semana (tempo, exercícios, séries)' },
  { id: 'volume-week', label: 'Volume semanal por músculo' },
  { id: 'mobility-minutes', label: 'Mobilidade da semana' },
  { id: 'exercise-counts', label: 'Os teus exercícios' },
] as const;

export const DEFAULT_WIDGETS = ['next-workout', 'week-summary', 'volume-week', 'mobility-minutes', 'exercise-counts'];

/** Definições antigas: «weekly-sets» passou a «volume-week». Ids desconhecidos e repetidos saem. */
export function normalizeWidgets(saved: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of saved) {
    const id = raw === 'weekly-sets' ? 'volume-week' : raw;
    if (WIDGETS.some((w) => w.id === id) && !out.includes(id)) out.push(id);
  }
  return out;
}

