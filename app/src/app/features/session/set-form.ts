import type { Kind, MetricType, SetType, Side } from '../../data/models/enums';
import type { SessionSet, SetGroup, SideEntry } from '../../data/models/session';
import type { NextSet, SetValues } from '../../core/session/next-set';

/**
 * Formulário de uma série (folha «Registar série»): texto dos campos ↔ valores da base.
 * No cardio a duração escreve-se em minutos e a distância em km; no resto, segundos e metros não se mostram.
 */
export interface SideForm {
  weight: string;
  reps: string;
  /** Segundos (minutos no cardio). */
  duration: string;
  /** km */
  distance: string;
  calories: string;
  rom: number | null;
  rir: number | null;
}

export interface SheetState {
  exerciseId: string;
  /** null = série nova. */
  position: number | null;
  type: SetType;
  sides: Partial<Record<Side, SideForm>>;
}

export interface SheetSave {
  position: number | null;
  type: SetType;
  entries: SideEntry[];
}

export const EMPTY_FORM: SideForm = { weight: '', reps: '', duration: '', distance: '', calories: '', rom: null, rir: null };

export const toNum = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const str = (n: number | null | undefined, digits = 2): string =>
  n === null || n === undefined ? '' : String(Math.round(n * 10 ** digits) / 10 ** digits);

/** Valores (base) → campos. */
export function formOf(kind: Kind, v: SetValues, extra: { rom?: number | null; rir?: number | null } = {}): SideForm {
  return {
    weight: str(v.weightKg),
    reps: str(v.reps, 0),
    duration: kind === 'CARDIO' ? str(v.durationSeconds === null ? null : v.durationSeconds / 60) : str(v.durationSeconds, 0),
    distance: str(v.distanceM === null ? null : v.distanceM / 1000),
    calories: str(v.caloriesKcal, 0),
    rom: extra.rom ?? null,
    rir: extra.rir ?? null,
  };
}

/** Uma série guardada → campos (com a reserva e a amplitude dela). */
export const formOfSet = (kind: Kind, s: SessionSet): SideForm => formOf(kind, s, { rom: s.romScore, rir: s.rir });

/** Proposta da série seguinte → campos de cada lado (vazio onde não há proposta). */
export function formsOfNext(kind: Kind, next: NextSet, sides: Side[]): Partial<Record<Side, SideForm>> {
  const out: Partial<Record<Side, SideForm>> = {};
  for (const side of sides) out[side] = next[side] ? formOf(kind, next[side]!) : { ...EMPTY_FORM };
  return out;
}

/**
 * Campos → entradas para gravar. Nos unilaterais pode registar-se só um lado (o vazio fica de fora).
 * A reserva só vale em séries de trabalho de força.
 */
export function entriesOf(kind: Kind, metric: MetricType, state: Pick<SheetState, 'type' | 'sides'>, sides: Side[]): SideEntry[] {
  const out: SideEntry[] = [];
  for (const side of sides) {
    const f = state.sides[side] ?? EMPTY_FORM;
    const filled = metric === 'DURATION' ? toNum(f.duration) : toNum(f.reps);
    if (!filled && sides.length > 1) continue;
    const duration = toNum(f.duration);
    const distance = toNum(f.distance);
    out.push({
      side,
      weightKg: toNum(f.weight),
      reps: toNum(f.reps),
      durationSeconds: duration === null ? null : kind === 'CARDIO' ? Math.round(duration * 60) : duration,
      distanceM: distance === null ? null : Math.round(distance * 1000),
      caloriesKcal: toNum(f.calories),
      romScore: f.rom,
      rir: kind === 'STRENGTH' && state.type === 'WORKING' ? f.rir : null,
    });
  }
  return out;
}

/** Entradas de uma proposta, para o registo de um toque (sem reserva nem amplitude). */
export function entriesOfNext(next: NextSet, sides: Side[]): SideEntry[] {
  return sides
    .filter((side) => next[side])
    .map((side) => ({ side, ...next[side]!, romScore: null, rir: null }));
}

/** A mesma série com outra reserva (resposta ao «Quantas ficaram?» depois do registo de um toque). */
export function entriesWithRir(group: SetGroup, rir: number | null): SideEntry[] {
  return group.sets.map((s) => ({
    side: s.side, weightKg: s.weightKg, reps: s.reps, durationSeconds: s.durationSeconds, distanceM: s.distanceM,
    caloriesKcal: s.caloriesKcal, rpe: s.rpe, romScore: s.romScore, rir,
  }));
}
