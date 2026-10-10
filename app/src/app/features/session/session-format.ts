import type { Kind, MetricType, Side } from '../../data/models/enums';
import type { SessionExercise, SessionSet, SetGroup } from '../../data/models/session';
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
