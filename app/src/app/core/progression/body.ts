import type { Goal, Level } from '../metrics/volume';
import { addDays } from '../util/week';

/**
 * Ritmo de peso (especificação «Objetivos e corpo»). Média dos últimos 7 dias contra a dos 7 anteriores, em % por
 * semana; precisa de 3 pesagens em cada janela (escolhas da app). Faixas por objetivo: ver rules.ts `pace.*`.
 */
export interface WeightRecord {
  date: string;
  value: number;
}

export const PACE = {
  windowDays: 7,
  minWeighIns: 3,
  /** Escolha da app: «peso estável» na manutenção. */
  maintenanceBand: 0.25,
  /** Escolha da app: hipertrofia com o peso «parado» em 4 semanas (menos de +0,25% no total). */
  stallWeeks: 4,
  stallTotal: 0.25,
} as const;

function avg(records: WeightRecord[], from: string, to: string): { value: number; n: number } | null {
  const xs = records.filter((r) => r.date >= from && r.date <= to).map((r) => r.value);
  return xs.length ? { value: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length } : null;
}

/** Variação semanal do peso em % (null sem pesagens suficientes). */
export function weeklyPace(records: WeightRecord[], today: string): number | null {
  const recent = avg(records, addDays(today, -(PACE.windowDays - 1)), today);
  const prev = avg(records, addDays(today, -(2 * PACE.windowDays - 1)), addDays(today, -PACE.windowDays));
  if (!recent || !prev || recent.n < PACE.minWeighIns || prev.n < PACE.minWeighIns) return null;
  return ((recent.value - prev.value) / prev.value) * 100;
}

/** Variação em % entre a última semana e a semana de há 4 semanas (null sem pesagens suficientes). */
export function fourWeekChange(records: WeightRecord[], today: string): number | null {
  const recent = avg(records, addDays(today, -6), today);
  const old = avg(records, addDays(today, -(PACE.stallWeeks * 7 + 6)), addDays(today, -PACE.stallWeeks * 7));
  if (!recent || !old || recent.n < PACE.minWeighIns || old.n < PACE.minWeighIns) return null;
  return ((recent.value - old.value) / old.value) * 100;
}

export interface PaceBand {
  /** % do peso por semana. */
  min: number;
  max: number;
  rule: string;
  text: string;
}

export function paceBand(goal: Goal, level: Level): PaceBand | null {
  switch (goal) {
    case 'hypertrophy':
      return level === 'advanced'
        ? { min: 0, max: 0.25, rule: 'pace.hypertrophy', text: '0 a +0,25% por semana' }
        : { min: 0.25, max: 0.5, rule: 'pace.hypertrophy', text: '+0,25 a +0,5% por semana' };
    case 'cut':
      return { min: -1, max: -0.5, rule: 'pace.cut', text: '−0,5 a −1% por semana' };
    case 'maintenance':
      return { min: -PACE.maintenanceBand, max: PACE.maintenanceBand, rule: 'pace.maintenance', text: 'peso estável (±0,25% por semana)' };
    default:
      return null;
  }
}

export type PaceStatus = 'below' | 'ok' | 'above';

export function paceStatus(pct: number, band: PaceBand): PaceStatus {
  if (pct < band.min - 1e-9) return 'below';
  if (pct > band.max + 1e-9) return 'above';
  return 'ok';
}

const pctTxt = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}%`;
export const formatPace = (x: number) => `${pctTxt(x)} por semana`;

/** Frase do aviso quando o ritmo sai da faixa do objetivo; null se está dentro. */
export function paceMessage(goal: Goal, level: Level, pct: number): string | null {
  const band = paceBand(goal, level);
  if (!band) return null;
  const st = paceStatus(pct, band);
  if (st === 'ok') return null;
  const now = `O teu peso está a variar ${formatPace(pct)}`;
  if (goal === 'cut') {
    return st === 'below'
      ? `${now}: mais de 1% por semana. Ritmos mais lentos preservaram melhor a massa magra.`
      : `${now}: abaixo dos 0,5–1% por semana do objetivo de definição.`;
  }
  if (goal === 'hypertrophy') {
    return st === 'above'
      ? `${now}: acima dos ${band.text} propostos para o teu nível.`
      : `${now}: abaixo dos ${band.text} propostos para o teu nível.`;
  }
  return `${now}: fora do peso estável da manutenção (±0,25% por semana).`;
}
