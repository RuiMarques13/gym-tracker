/**
 * Estimativa de calorias ativas (kcal acima do repouso) quando o relógio não as dá.
 * Dois caminhos, do mais para o menos fiável:
 *  1. com frequência cardíaca média: fórmula de Keytel et al. (2005), válida sobretudo em esforço aeróbio;
 *  2. sem ela: equivalentes metabólicos (MET) do Compêndio de Atividades Físicas, ajustados à velocidade quando há distância.
 * O valor do relógio (Health Connect) tem sempre prioridade sobre qualquer estimativa daqui.
 */
export interface BodyProfile {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: 'F' | 'M' | 'O' | null;
}

/** Repouso ≈ 1 MET: as calorias «ativas» são só o que passa disso. */
const REST_MET = 1;
const KCAL_PER_KG_PER_H_PER_MET = 1; // 1 MET ≈ 1 kcal/kg/h

/** Gasto total (com o repouso) por minuto, em kcal, pela fórmula de Keytel. Sexo «O»: média das duas. */
export function keytelKcalPerMin(hr: number, body: { weightKg: number; age: number; sex: 'F' | 'M' | 'O' }): number {
  const male = (-55.0969 + 0.6309 * hr + 0.1988 * body.weightKg + 0.2017 * body.age) / 4.184;
  const female = (-20.4022 + 0.4472 * hr - 0.1263 * body.weightKg + 0.074 * body.age) / 4.184;
  const v = body.sex === 'M' ? male : body.sex === 'F' ? female : (male + female) / 2;
  return Math.max(0, v);
}

/** MET da marcha (ACSM): VO₂ = 0,1·v + 3,5 ml/kg/min, v em m/min. */
export function walkingMet(speedKmh: number): number {
  return (0.1 * ((speedKmh * 1000) / 60) + 3.5) / 3.5;
}

/** MET da corrida (ACSM): VO₂ = 0,2·v + 3,5. */
export function runningMet(speedKmh: number): number {
  return (0.2 * ((speedKmh * 1000) / 60) + 3.5) / 3.5;
}

export type CardioActivity = 'walk' | 'run' | 'bike' | 'elliptical' | 'row' | 'other';

export function cardioActivity(name: string): CardioActivity {
  const n = name.toLowerCase();
  if (/(caminh|andar|marcha|walk)/.test(n)) return 'walk';
  if (/(corr|run|jog|sprint)/.test(n)) return 'run';
  if (/(bici|cicl|bike|cycl|spinning)/.test(n)) return 'bike';
  if (/(el[ií]pt|elliptic)/.test(n)) return 'elliptical';
  if (/(remo|row)/.test(n)) return 'row';
  return 'other';
}

/** MET de uma atividade de cardio. Com velocidade conhecida, usa-a (marcha/corrida). */
export function cardioMet(name: string, speedKmh?: number | null): number {
  const a = cardioActivity(name);
  const v = speedKmh && speedKmh > 0 ? speedKmh : null;
  if (a === 'walk') return v ? walkingMet(Math.min(v, 7)) : 3.5;
  if (a === 'run') return v ? runningMet(Math.max(v, 6)) : 9;
  if (a === 'bike') return v ? Math.min(14, Math.max(3.5, 0.55 * v - 1)) : 7;
  if (a === 'elliptical') return 5;
  if (a === 'row') return 7;
  return 6;
}

export type Intensity = { kind: 'STRENGTH' | 'MOBILITY' | 'CARDIO'; name?: string; speedKmh?: number | null };

/** MET de uma série ativa (força, mobilidade ou cardio). */
export function activeMet(x: Intensity): number {
  if (x.kind === 'CARDIO') return cardioMet(x.name ?? '', x.speedKmh);
  return x.kind === 'MOBILITY' ? 2.8 : 5;
}

/** MET dos intervalos de descanso entre séries: a pé, parado, a respirar fundo. */
export const RECOVERY_MET = 1.6;

export interface Segment {
  seconds: number;
  met: number;
}

/** kcal ativas de uma lista de segmentos, ou null se faltar o peso. */
export function estimateFromMet(weightKg: number | null, segments: readonly Segment[]): number | null {
  if (!weightKg || weightKg <= 0) return null;
  let kcal = 0;
  for (const s of segments) {
    if (s.seconds <= 0) continue;
    kcal += Math.max(0, s.met - REST_MET) * weightKg * KCAL_PER_KG_PER_H_PER_MET * (s.seconds / 3600);
  }
  return Math.round(kcal);
}

/**
 * kcal ativas de um treino. Com FC média e perfil completo usa Keytel (descontando o repouso);
 * senão usa os MET dos segmentos. Devolve a origem para a app poder dizer «estimado».
 */
export function estimateActiveKcal(args: {
  body: BodyProfile;
  /** Duração total em segundos. */
  totalSeconds: number;
  avgHr?: number | null;
  segments: readonly Segment[];
}): { kcal: number; basis: 'heart-rate' | 'met' } | null {
  const { body, totalSeconds, avgHr, segments } = args;
  if (!body.weightKg) return null;
  if (avgHr && avgHr >= 60 && body.age && body.sex && totalSeconds > 0) {
    const total = keytelKcalPerMin(avgHr, { weightKg: body.weightKg, age: body.age, sex: body.sex }) * (totalSeconds / 60);
    const rest = REST_MET * body.weightKg * KCAL_PER_KG_PER_H_PER_MET * (totalSeconds / 3600);
    return { kcal: Math.max(0, Math.round(total - rest)), basis: 'heart-rate' };
  }
  const kcal = estimateFromMet(body.weightKg, segments);
  return kcal === null ? null : { kcal, basis: 'met' };
}
