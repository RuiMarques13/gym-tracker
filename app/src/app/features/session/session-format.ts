import type { Kind, MetricType, Side } from '../../data/models/enums';
import type { SessionExercise, SessionSet, SetGroup } from '../../data/models/session';
import type { NextSet } from '../../core/session/next-set';
import { formatDistance, formatDuration } from '../workouts/workout-format';

const SIDE_LABEL: Record<Side, string> = { BOTH: '', LEFT: 'Esq', RIGHT: 'Dir' };
const num = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 2 });

/** Uma linha de série sem o lado: «60 kg × 8», «12 reps», «45 s», «20 min · 5 km». */
export function formatSetValues(kind: Kind, metric: MetricType, s: SessionSet): string {
  if (metric === 'DURATION') {
    const parts: string[] = [];
    if (s.durationSeconds) parts.push(formatDuration(s.durationSeconds));
    if (kind === 'CARDIO') {
      if (s.distanceM) parts.push(formatDistance(s.distanceM));
      if (s.caloriesKcal) parts.push(`${num(s.caloriesKcal)} kcal`);
    }
    return parts.join(' · ');
  }
  const reps = s.reps ?? 0;
  if (metric === 'WEIGHT_REPS') return s.weightKg ? `${num(s.weightKg)} kg × ${reps}` : `${reps} reps`;
  return `${reps} reps`;
}

/** Série completa para mostrar na lista, com os dois lados quando é unilateral. */
export function formatSetGroup(ex: Pick<SessionExercise, 'kind' | 'metricType'>, group: SetGroup): string {
  const sides = group.sets.map((s) => {
    const values = formatSetValues(ex.kind, ex.metricType, s);
    return s.side === 'BOTH' ? values : `${SIDE_LABEL[s.side]} ${values}`;
  });
  const rom = group.sets.map((s) => s.romScore).filter((r): r is number => r !== null);
  return sides.join(' · ') + (rom.length ? ` · amplitude ${rom.join('/')}` : '');
}

/** «60 kg» */
export const kgLabel = (x: number): string => `${num(x)} kg`;

/**
 * Texto do botão de um toque: «60 kg × 10», «12 reps», «45 s». Unilateral com os dois lados iguais: «… cada lado»;
 * diferentes: «Esq 20 kg × 10 · Dir 20 kg × 9».
 */
export function quickLabel(kind: Kind, metric: MetricType, next: NextSet, sides: Side[]): string {
  const asSet = (side: Side): SessionSet => ({
    id: '', position: 0, type: 'WORKING', side, rpe: null, rir: null, romScore: null, restSecondsActual: null, completedAt: null,
    weightKg: null, reps: null, durationSeconds: null, distanceM: null, caloriesKcal: null, ...next[side],
  });
  const texts = sides.map((side) => formatSetValues(kind, metric, asSet(side)));
  if (sides.length === 1) return texts[0];
  if (texts.every((t) => t === texts[0])) return `${texts[0]} cada lado`;
  return sides.map((side, i) => `${SIDE_LABEL[side]} ${texts[i]}`).join(' · ');
}
