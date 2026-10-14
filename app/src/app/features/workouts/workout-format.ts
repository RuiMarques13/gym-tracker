import type { Kind, MetricType } from '../../data/models/enums';

export interface TargetsLike {
  targetSets?: number | null;
  targetRepsMin?: number | null;
  targetReps?: number | null;
  targetDurationSeconds?: number | null;
  targetWeightKg?: number | null;
  targetDistanceM?: number | null;
  restSeconds?: number | null;
}

export function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m} min ${s} s` : `${m} min`;
  }
  return `${seconds} s`;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} km` : `${m} m`;
}

/** «4 × 8 · 60 kg» ou «3 × 8–12»; «4 × 8 · 60 kg · descanso 2 min», «2 × 45 s por lado», «20 min · 5 km». */
export function formatTargets(kind: Kind, metric: MetricType, unilateral: boolean, t: TargetsLike): string {
  const parts: string[] = [];
  const sets = t.targetSets ?? null;
  const side = unilateral ? ' por lado' : '';
  if (kind === 'CARDIO') {
    if (sets && sets > 1) parts.push(`${sets} ×`);
    if (t.targetDurationSeconds) parts.push(formatDuration(t.targetDurationSeconds));
    if (t.targetDistanceM) parts.push(formatDistance(t.targetDistanceM));
  } else if (metric === 'DURATION') {
    const d = t.targetDurationSeconds ? formatDuration(t.targetDurationSeconds) : '?';
    parts.push(sets ? `${sets} × ${d}${side}` : `${d}${side}`);
  } else {
    const r = t.targetRepsMin && t.targetReps && t.targetRepsMin < t.targetReps ? `${t.targetRepsMin}–${t.targetReps}` : (t.targetReps ?? '?');
    parts.push(sets ? `${sets} × ${r}${side}` : `${r} reps${side}`);
    if (metric === 'WEIGHT_REPS' && t.targetWeightKg) parts.push(`${t.targetWeightKg.toLocaleString('pt-PT')} kg`);
  }
  if (t.restSeconds) parts.push(`descanso ${formatDuration(t.restSeconds)}`);
  return parts.join(' · ').replace(' × ·', ' ×');
}

export { normalizeSupersets } from '../../data/models/workout';
