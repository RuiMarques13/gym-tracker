/**
 * Sinais de fadiga (escolha da app; ver rules.ts, `fatigue.signals`). Basta um para sugerir descarga, que é o que o
 * consenso de Bell 2023 recomenda «quando o atleta se sente fatigado».
 */
export interface FatigueInput {
  /** Esforço (sRPE 0–10) das últimas sessões terminadas, da mais recente para a mais antiga. */
  rpes: (number | null)[];
  /** RIR das séries de trabalho das últimas sessões, da mais recente para a mais antiga. */
  rirBySession: (number | null)[][];
  /** Mínimo de RIR que o teu nível pede (volume-rules.ts). */
  levelRirMin: number;
  /** Dor muscular registada nos últimos 3 dias. */
  soreness: { muscle: string; level: number }[];
  /** Variação semanal do 1RM estimado dos exercícios principais, da mais antiga para a mais recente. */
  perfTrend: number[];
}

export interface FatigueSignal {
  key: 'rpe' | 'rir' | 'soreness' | 'performance';
  text: string;
}

export const FATIGUE = {
  rpeHigh: 9,
  rpeCount: 2,
  rpeWindow: 3,
  rirSessions: 2,
  rirZeroShare: 0.5,
  sorenessHigh: 4,
  perfDrop: -0.02,
  perfWeeks: 2,
} as const;

export function fatigueSignals(i: FatigueInput, label: (muscle: string) => string = (m) => m): FatigueSignal[] {
  const out: FatigueSignal[] = [];
  const rpes = i.rpes.filter((x): x is number => x !== null).slice(0, FATIGUE.rpeWindow);
  const high = rpes.filter((x) => x >= FATIGUE.rpeHigh).length;
  if (high >= FATIGUE.rpeCount) out.push({ key: 'rpe', text: `Esforço ${FATIGUE.rpeHigh}–10 em ${high} das últimas ${rpes.length} sessões.` });

  const rirs = i.rirBySession.slice(0, FATIGUE.rirSessions).flat().filter((x): x is number => x !== null);
  const zeros = rirs.filter((x) => x === 0).length;
  if (i.levelRirMin >= 1 && rirs.length >= 4 && zeros / rirs.length > FATIGUE.rirZeroShare) {
    out.push({ key: 'rir', text: `${zeros} de ${rirs.length} séries a 0 em reserva nas últimas sessões; o teu nível pede ${i.levelRirMin} ou mais.` });
  }

  const sore = [...new Set(i.soreness.filter((s) => s.level >= FATIGUE.sorenessHigh).map((s) => s.muscle))];
  if (sore.length) out.push({ key: 'soreness', text: `Dor muscular forte: ${sore.map(label).join(', ')}.` });

  const last = i.perfTrend.slice(-FATIGUE.perfWeeks);
  if (last.length === FATIGUE.perfWeeks && last.every((c) => c < FATIGUE.perfDrop)) {
    out.push({ key: 'performance', text: `O 1RM estimado dos exercícios principais caiu ${last.map((c) => `${Math.round(-c * 100)}%`).join(' e ')} nas últimas 2 semanas.` });
  }
  return out;
}
