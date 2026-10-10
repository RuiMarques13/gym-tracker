/** Lógica pura dos dados de saúde: reduzir e resumir as amostras de frequência cardíaca. */
export interface HrPoint {
  /** ISO 8601 */
  ts: string;
  bpm: number;
}

export interface HrSummary {
  avg: number | null;
  max: number | null;
  min: number | null;
  samples: number;
}

/**
 * Junta as amostras em janelas de `windowSec` segundos (média por janela) e descarta valores impossíveis.
 * O relógio dá uma amostra a cada poucos segundos; guardar uma por ~10 s chega para o gráfico.
 */
export function downsample(points: readonly HrPoint[], windowSec = 10): HrPoint[] {
  const valid = points
    .filter((p) => Number.isFinite(p.bpm) && p.bpm >= 20 && p.bpm <= 260 && !Number.isNaN(Date.parse(p.ts)))
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const p of valid) {
    const k = Math.floor(Date.parse(p.ts) / (windowSec * 1000));
    const b = buckets.get(k) ?? { sum: 0, n: 0 };
    b.sum += p.bpm;
    b.n += 1;
    buckets.set(k, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, b]) => ({ ts: new Date(k * windowSec * 1000).toISOString(), bpm: Math.round(b.sum / b.n) }));
}

export function summarize(points: readonly HrPoint[]): HrSummary {
  if (!points.length) return { avg: null, max: null, min: null, samples: 0 };
  let sum = 0, max = -Infinity, min = Infinity;
  for (const p of points) {
    sum += p.bpm;
    max = Math.max(max, p.bpm);
    min = Math.min(min, p.bpm);
  }
  return { avg: Math.round(sum / points.length), max, min, samples: points.length };
}

export interface HrChartPoint {
  /** Minuto desde o início do treino (ponto central do intervalo). */
  minute: number;
  bpm: number;
}

/**
 * Reduz as amostras a no máximo `maxPoints` pontos para o gráfico: média por intervalos de 1 min
 * (ou de vários minutos, em treinos longos). `minute` conta desde o início do treino.
 */
export function chartSeries(points: readonly HrPoint[], startIso: string, maxPoints = 60): HrChartPoint[] {
  const t0 = Date.parse(startIso);
  const valid = points.filter((p) => Number.isFinite(p.bpm) && Date.parse(p.ts) >= t0 - 60_000);
  if (!valid.length || Number.isNaN(t0)) return [];
  const lastMin = Math.max(0, (Date.parse(valid[valid.length - 1].ts) - t0) / 60_000);
  const step = Math.max(1, Math.ceil((lastMin + 1) / maxPoints));
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const p of valid) {
    const k = Math.floor(Math.max(0, (Date.parse(p.ts) - t0) / 60_000) / step);
    const b = buckets.get(k) ?? { sum: 0, n: 0 };
    b.sum += p.bpm;
    b.n += 1;
    buckets.set(k, b);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([k, b]) => ({ minute: Math.round(k * step + step / 2), bpm: Math.round(b.sum / b.n) }));
}
