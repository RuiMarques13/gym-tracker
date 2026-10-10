import type { SessionSet } from '../../data/models/session';

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
/** 1RM estimado (Epley) de uma série de trabalho com carga; null se não se aplica. */
export function epley(s: Pick<SessionSet, 'weightKg' | 'reps' | 'type'>): number | null {
  if (s.type !== 'WORKING' || !s.weightKg || !s.reps) return null;
  return s.reps === 1 ? s.weightKg : Math.round(s.weightKg * (1 + s.reps / 30) * 10) / 10;
}
