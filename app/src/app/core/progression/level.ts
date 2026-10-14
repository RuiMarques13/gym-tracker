import type { Level } from '../metrics/volume';
import { addDays, weekStartOf } from '../util/week';

/**
 * Nível sugerido pelo histórico. ACSM 2009: noviço = sem experiência; intermédio = cerca de 6 meses de treino
 * consistente; avançado = anos. Escolhas da app (ver rules.ts `level.suggest`): «consistente» = semanas com treino de
 * força sem pausas de 3 ou mais semanas seguidas; «anos» = 3 anos (o mesmo limite que o perfil já mostrava).
 * Só sugere subir: o histórico na app pode ser mais curto do que os teus anos de treino.
 */
export const LEVEL = { maxGapWeeks: 2, intermediateMonths: 6, advancedMonths: 36 } as const;
const WEEKS_PER_MONTH = 52 / 12;

/** Meses de treino consistente até hoje, a partir dos dias com sessões de força («YYYY-MM-DD»). */
export function consistentMonths(sessionDays: string[], today: string): number {
  const weeks = new Set(sessionDays.map((d) => weekStartOf(d)));
  let w = weekStartOf(today);
  let gap = 0;
  let start: string | null = null;
  for (let i = 0; i < 52 * 30; i++) {
    if (weeks.has(w)) {
      start = w;
      gap = 0;
    } else if (++gap > LEVEL.maxGapWeeks) {
      break;
    }
    w = addDays(w, -7);
  }
  if (!start) return 0;
  const span = Math.round((Date.parse(weekStartOf(today)) - Date.parse(start)) / (7 * 86_400_000)) + 1;
  return span / WEEKS_PER_MONTH;
}

export function levelFromMonths(months: number): Level {
  if (months >= LEVEL.advancedMonths) return 'advanced';
  if (months >= LEVEL.intermediateMonths) return 'intermediate';
  return 'beginner';
}

const ORDER: Level[] = ['beginner', 'intermediate', 'advanced'];
/** O nível a sugerir, só se for acima do atual. */
export function levelSuggestion(current: Level, months: number): Level | null {
  const s = levelFromMonths(months);
  return ORDER.indexOf(s) > ORDER.indexOf(current) ? s : null;
}
