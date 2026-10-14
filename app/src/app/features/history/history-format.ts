import { estimate1RM } from '../../core/metrics/one-rm';
import type { ExerciseHistoryEntry, SessionSet } from '../../data/models/session';

const loc = 'pt-PT';

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.(?=,|\s|$)/g, '');
}
export function formatMonth(iso: string): string {
  const m = new Date(iso).toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  return m.charAt(0).toUpperCase() + m.slice(1);
}
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}
/** Duração entre dois instantes: «45 min», «1 h 05». */
export function formatSpan(startIso: string, endIso: string): string {
  const min = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
export function formatVolume(kg: number): string {
  return `${Math.round(kg).toLocaleString(loc)} kg`;
}
/** 1RM estimado (Epley, a fórmula única da app) de uma série de trabalho com carga; null se não se aplica. */
export function epley(s: Pick<SessionSet, 'weightKg' | 'reps' | 'type'>): number | null {
  if (s.type !== 'WORKING') return null;
  const v = estimate1RM(s.weightKg, s.reps);
  return v === null ? null : Math.round(v * 10) / 10;
}

export interface SessionProgress {
  at: string;
  /** Melhor 1RM estimado (Epley) da sessão. */
  e1rm: number;
  /** Volume-carga: soma de carga × repetições das séries de trabalho. */
  volume: number;
  /** Maior carga usada numa série de trabalho. */
  topWeight: number;
}

/** Uma linha por sessão, da mais antiga à mais recente; sessões sem séries de trabalho com carga ficam de fora. */
export function progressSeries(entries: ExerciseHistoryEntry[]): SessionProgress[] {
  const out: SessionProgress[] = [];
  for (const h of entries) {
    let e1rm = 0, volume = 0, topWeight = 0;
    for (const s of h.sets) {
      if (s.type !== 'WORKING' || !s.weightKg || !s.reps) continue;
      e1rm = Math.max(e1rm, epley(s) ?? 0);
      volume += s.weightKg * s.reps;
      topWeight = Math.max(topWeight, s.weightKg);
    }
    if (e1rm > 0) out.push({ at: h.startedAt, e1rm, volume: Math.round(volume), topWeight });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
