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

export interface EnergyRecord {
  startDate: string;
  endDate: string;
  value: number;
}

/**
 * Soma a energia dos registos que tocam o intervalo, **proporcional à parte que cai lá dentro**.
 * O Samsung escreve em blocos que começam antes ou acabam depois do treino; descartá-los (como se fazia)
 * dava menos calorias do que as reais. Registos sem duração contam inteiros se estiverem dentro.
 */
export function energyWithin(records: readonly EnergyRecord[], startIso: string, endIso: string): number {
  const lo = Date.parse(startIso), hi = Date.parse(endIso);
  if (Number.isNaN(lo) || Number.isNaN(hi) || hi <= lo) return 0;
  let total = 0;
  for (const r of records) {
    const a = Date.parse(r.startDate), b = Date.parse(r.endDate);
    if (!Number.isFinite(r.value) || r.value <= 0 || Number.isNaN(a) || Number.isNaN(b)) continue;
    if (b <= a) {
      if (a >= lo && a <= hi) total += r.value;
      continue;
    }
    const overlap = Math.min(b, hi) - Math.max(a, lo);
    if (overlap > 0) total += r.value * (overlap / (b - a));
  }
  return total;
}

/* ───────────── Calorias: total, basal e ativas ───────────── */

/**
 * Escolhe os registos de energia que correspondem ao treino. O Samsung escreve um registo por exercício
 * (início/fim ≈ os do treino) mas há apps que escrevem blocos de várias horas; se existir um registo
 * que «encaixa» (±5 min) usam-se só esses, senão distribui-se proporcionalmente (energyWithin).
 */
export function energyForWorkout(records: readonly EnergyRecord[], startIso: string, endIso: string, toleranceMs = 5 * 60_000): number {
  const lo = Date.parse(startIso), hi = Date.parse(endIso);
  const fits = records.filter((r) => Math.abs(Date.parse(r.startDate) - lo) <= toleranceMs && Math.abs(Date.parse(r.endDate) - hi) <= toleranceMs);
  return energyWithin(fits.length ? fits : records, startIso, endIso);
}

/** Taxa metabólica de repouso lida do relógio (kcal/dia, instantânea). */
export interface BmrSample {
  ts: string;
  kcalPerDay: number;
}

/** O valor mais recente que não passe do fim do treino (o Samsung escreve poucos por dia). */
export function latestBmr(samples: readonly BmrSample[], endIso: string): number | null {
  const hi = Date.parse(endIso);
  let best: BmrSample | null = null;
  for (const s of samples) {
    const t = Date.parse(s.ts);
    if (!Number.isFinite(s.kcalPerDay) || s.kcalPerDay < 500 || s.kcalPerDay > 6000 || Number.isNaN(t) || t > hi) continue;
    if (!best || t > Date.parse(best.ts)) best = s;
  }
  return best ? best.kcalPerDay : null;
}

/** Mifflin-St Jeor (kcal/dia): usado só quando o relógio não deu a taxa basal. */
export function mifflinBmr(body: { weightKg: number | null; heightCm: number | null; age: number | null; sex: 'F' | 'M' | 'O' | null }): number | null {
  const { weightKg: w, heightCm: h, age: a, sex } = body;
  if (!w || !h || !a) return null;
  const base = 10 * w + 6.25 * h - 5 * a;
  return Math.round(sex === 'M' ? base + 5 : sex === 'F' ? base - 161 : base - 78);
}

export type CaloriesBasis =
  /** Calorias ativas escritas pelo relógio. */
  | 'watch-active'
  /** Total do relógio menos o repouso. */
  | 'watch-total';

export interface CaloriesBreakdown {
  /** Gasto total (inclui o repouso), kcal. */
  totalKcal: number | null;
  /** Gasto acima do repouso, kcal. */
  activeKcal: number | null;
  /** Repouso durante o treino, kcal. */
  basalKcal: number | null;
  basis: CaloriesBasis | null;
}

/**
 * Junta o que o relógio deu. O Samsung escreve o **total** do exercício (TotalCaloriesBurned) e não as ativas;
 * as ativas obtêm-se tirando o repouso: ativas = total − basal·tempo (basal do relógio ou Mifflin).
 * Se existirem ativas gravadas, valem sobre a conta.
 */
export function deriveCalories(args: {
  activeRecords: readonly EnergyRecord[];
  totalRecords: readonly EnergyRecord[];
  /** Repouso em kcal/dia (relógio ou Mifflin); null se não se conhece. */
  bmrKcalPerDay: number | null;
  startIso: string;
  endIso: string;
}): CaloriesBreakdown {
  const { startIso, endIso, bmrKcalPerDay } = args;
  const seconds = Math.max(0, (Date.parse(endIso) - Date.parse(startIso)) / 1000);
  const active = energyForWorkout(args.activeRecords, startIso, endIso);
  const total = energyForWorkout(args.totalRecords, startIso, endIso);
  const basal = bmrKcalPerDay && seconds > 0 ? (bmrKcalPerDay * seconds) / 86400 : null;
  const r = (n: number | null) => (n === null ? null : Math.round(n));

  if (active > 0) {
    // total: o do relógio; senão ativas + repouso
    const t = total > 0 ? total : basal !== null ? active + basal : null;
    return { totalKcal: r(t), activeKcal: r(active), basalKcal: basal !== null ? r(basal) : t !== null ? r(t - active) : null, basis: 'watch-active' };
  }
  if (total > 0) {
    if (basal === null) return { totalKcal: r(total), activeKcal: null, basalKcal: null, basis: null };
    return { totalKcal: r(total), activeKcal: r(Math.max(0, total - basal)), basalKcal: r(Math.min(total, basal)), basis: 'watch-total' };
  }
  return { totalKcal: null, activeKcal: null, basalKcal: null, basis: null };
}

/* ───────────── Frequência cardíaca: recuperação e zonas ───────────── */

function meanBetween(points: readonly HrPoint[], fromMs: number, toMs: number): number | null {
  const v = points.filter((p) => {
    const t = Date.parse(p.ts);
    return t >= fromMs && t <= toMs;
  });
  return v.length ? v.reduce((s, p) => s + p.bpm, 0) / v.length : null;
}

export interface HrRecovery {
  /** FC média nos últimos 30 s do treino. */
  atEnd: number;
  /** FC média por volta de 1 min depois (45–75 s). */
  after1min: number;
  /** Queda em 1 min (atEnd − after1min). Quanto maior, melhor; ≤ 12 bpm associa-se a mais risco. */
  drop: number;
}

/** Recuperação da FC no 1.º minuto após o fim; null se faltarem amostras de um dos dois momentos. */
export function heartRateRecovery(points: readonly HrPoint[], endIso: string): HrRecovery | null {
  const end = Date.parse(endIso);
  if (Number.isNaN(end)) return null;
  const a = meanBetween(points, end - 30_000, end);
  const b = meanBetween(points, end + 45_000, end + 75_000);
  if (a === null || b === null) return null;
  return { atEnd: Math.round(a), after1min: Math.round(b), drop: Math.round(a - b) };
}

/** FC máxima estimada (Tanaka 2001: 208 − 0,7·idade; erro típico ±10 bpm). */
export function hrMaxTanaka(age: number | null | undefined): number | null {
  return age && age > 0 && age < 110 ? Math.round(208 - 0.7 * age) : null;
}

export const HR_ZONES = [
  { id: 1, label: 'Muito leve', from: 0.5 },
  { id: 2, label: 'Leve', from: 0.6 },
  { id: 3, label: 'Moderada', from: 0.7 },
  { id: 4, label: 'Intensa', from: 0.8 },
  { id: 5, label: 'Máxima', from: 0.9 },
] as const;

/**
 * Segundos em cada zona de FC (% da FC máxima: 50–60, 60–70, 70–80, 80–90, 90–100). Abaixo de 50 % não conta.
 * Cada amostra vale até à seguinte (no máximo 30 s, para não contar buracos de leitura).
 * Só conta dentro de [startIso, endIso].
 */
export function timeInZones(points: readonly HrPoint[], hrMax: number, startIso: string, endIso: string): number[] {
  const out = [0, 0, 0, 0, 0];
  const lo = Date.parse(startIso), hi = Date.parse(endIso);
  const sorted = points.filter((p) => Number.isFinite(p.bpm)).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  for (let i = 0; i < sorted.length; i++) {
    const t = Date.parse(sorted[i].ts);
    if (t < lo || t > hi) continue;
    const next = i + 1 < sorted.length ? Date.parse(sorted[i + 1].ts) : hi;
    const secs = Math.max(0, Math.min(next, hi) - t) / 1000;
    const dur = Math.min(secs, 30);
    const pct = sorted[i].bpm / hrMax;
    let zone = -1;
    for (let z = 0; z < HR_ZONES.length; z++) if (pct >= HR_ZONES[z].from) zone = z;
    if (zone >= 0) out[zone] += dur;
  }
  return out.map((s) => Math.round(s));
}
