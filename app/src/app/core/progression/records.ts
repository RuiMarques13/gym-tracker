import { reliable1RM } from '../metrics/one-rm';

/**
 * Recordes pessoais (rules.ts, `records.what`; escolha da app):
 * - numa série de trabalho, a maior carga de sempre nesse exercício (pelo menos 1 repetição), ou
 * - o maior 1RM estimado (Epley, só até 10 repetições contando as de reserva: `reliable1RM`).
 * Só há recorde quando já havia séries de trabalho com carga desse exercício: a primeira vez não conta.
 */

export interface RecordSet {
  exerciseId: string;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  type: 'working' | 'warmup';
}

export interface Best {
  weightKg: number;
  /** 0 quando nenhuma série serve para estimar o 1RM. */
  e1rm: number;
}

export type RecordKind = 'weight' | 'e1rm';

export interface NewRecord {
  exerciseId: string;
  kind: RecordKind;
  weightKg: number;
  reps: number;
  /** Carga (kg) ou 1RM estimado (kg) novo e anterior, arredondados a 0,1. */
  value: number;
  previous: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const counts = (s: RecordSet): s is RecordSet & { weightKg: number; reps: number } =>
  s.type === 'working' && !!s.weightKg && s.weightKg > 0 && !!s.reps && s.reps >= 1;

/** Melhor carga e melhor 1RM estimado de cada exercício. */
export function bestOf(sets: readonly RecordSet[]): Map<string, Best> {
  const out = new Map<string, Best>();
  for (const s of sets) {
    if (!counts(s)) continue;
    const b = out.get(s.exerciseId) ?? { weightKg: 0, e1rm: 0 };
    const e = reliable1RM(s.weightKg, s.reps, s.rir) ?? 0;
    out.set(s.exerciseId, { weightKg: Math.max(b.weightKg, s.weightKg), e1rm: Math.max(b.e1rm, round1(e)) });
  }
  return out;
}

/** A série bate o melhor anterior? A carga ganha ao 1RM estimado quando batem os dois. */
export function recordOf(set: RecordSet, prev: Best | undefined): NewRecord | null {
  if (!prev || !counts(set)) return null;
  const base = { exerciseId: set.exerciseId, weightKg: set.weightKg, reps: set.reps };
  if (prev.weightKg > 0 && set.weightKg > prev.weightKg) return { ...base, kind: 'weight', value: set.weightKg, previous: prev.weightKg };
  const e = round1(reliable1RM(set.weightKg, set.reps, set.rir) ?? 0);
  if (prev.e1rm > 0 && e > prev.e1rm) return { ...base, kind: 'e1rm', value: e, previous: prev.e1rm };
  return null;
}

/**
 * Recordes de uma sessão: as séries por ordem, cada uma contra o melhor até ali (histórico + séries anteriores da
 * sessão). Fica um recorde por exercício: o último batido (o maior).
 */
export function sessionRecords(history: readonly RecordSet[], session: readonly RecordSet[]): NewRecord[] {
  const best = bestOf(history);
  const out = new Map<string, NewRecord>();
  for (const s of session) {
    const r = recordOf(s, best.get(s.exerciseId));
    if (r) out.set(s.exerciseId, r);
    if (best.has(s.exerciseId)) {
      const merged = bestOf([s]).get(s.exerciseId);
      if (merged) {
        const b = best.get(s.exerciseId)!;
        best.set(s.exerciseId, { weightKg: Math.max(b.weightKg, merged.weightKg), e1rm: Math.max(b.e1rm, merged.e1rm) });
      }
    }
  }
  return [...out.values()];
}
