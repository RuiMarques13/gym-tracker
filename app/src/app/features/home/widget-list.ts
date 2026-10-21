export const WIDGETS = [
  { id: 'week-progress', label: 'Alvo da semana vs progresso (gráfico)' },
  { id: 'volume-week', label: 'Volume semanal por músculo' },
  { id: 'recovery', label: 'Descanso recomendado por músculo' },
  { id: 'category-week', label: 'Semana por categoria (séries, carga, tempo, distância)' },
  { id: 'mobility-minutes', label: 'Mobilidade da semana' },
] as const;

/** A Home já mostra hoje, a semana, o volume e a recuperação: os widgets são extras, desligados por defeito. */
export const DEFAULT_WIDGETS: string[] = [];

/**
 * Definições antigas: «weekly-sets» passou a «volume-week»; «exercise-counts» (os teus exercícios) saiu e dá o lugar
 * ao gráfico do alvo da semana, que entra logo a seguir ao próximo treino. Ids desconhecidos e repetidos saem.
 */
export function normalizeWidgets(saved: readonly string[]): string[] {
  const out: string[] = [];
  let wantsChart = false;
  for (const raw of saved) {
    if (raw === 'exercise-counts') {
      wantsChart = true;
      continue;
    }
    const id = raw === 'weekly-sets' ? 'volume-week' : raw;
    if (WIDGETS.some((w) => w.id === id) && !out.includes(id)) out.push(id);
  }
  if (wantsChart && !out.includes('week-progress')) out.splice(out[0] === 'next-workout' ? 1 : 0, 0, 'week-progress');
  return out;
}
