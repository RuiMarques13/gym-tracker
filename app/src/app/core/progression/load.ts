import type { Mechanic } from '../../data/models/enums';

/**
 * Sugestão da próxima carga de um exercício (especificação «Progressão e ciclos na app»).
 *
 * Regra com fonte (ACSM 2009, categoria B): quando se faz 1–2 repetições acima do alvo em duas sessões seguidas,
 * subir 2–10% — menos nos exercícios de músculos pequenos, mais nos de músculos grandes. Aqui o «alvo» é o topo
 * da faixa de repetições. Entre subidas, a progressão faz-se por repetições (Plotkin 2022: hipertrofia parecida).
 *
 * Escolhas da app (sem número na literatura, editáveis no código e marcadas assim nas mensagens):
 * - multiarticular → a carga possível mais perto de +6%; monoarticular → a mais baixa do intervalo;
 * - RIR médio ≥ 4 no topo da faixa dispensa a segunda sessão;
 * - se o menor incremento passa os 10%, sobe-se primeiro até ao topo + 3 repetições;
 * - abaixo do mínimo em duas sessões seguidas → descer um incremento.
 */

export interface LoadSet {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
}
/** Séries de trabalho de uma sessão passada (os dois lados nos unilaterais). */
export interface PastSession {
  sets: LoadSet[];
}
export interface LoadInput {
  /** Da mais recente para a mais antiga. */
  history: PastSession[];
  repsMin: number;
  repsMax: number;
  mechanic: Mechanic | null;
  /** Incremento do equipamento em kg; null = não definido (a app mostra o intervalo sem escolher). */
  incrementKg: number | null;
}
export type LoadAction = 'start' | 'increase' | 'reps' | 'hold' | 'decrease';
export interface LoadSuggestion {
  action: LoadAction;
  /** Carga sugerida para hoje (null em «start» ou quando não há incremento para arredondar). */
  weightKg: number | null;
  /** Todas as cargas possíveis dentro do intervalo de 2–10% (para escolher outra com um toque). */
  options: number[];
  /** Intervalo de 2–10% em kg, quando a regra manda subir. */
  rangeKg: [number, number] | null;
  /** Faixa de repetições para hoje. */
  repsMin: number;
  repsMax: number;
  /** Frase curta para o cartão. */
  reason: string;
  /** De onde vem a regra: ACSM 2009 (fonte) ou escolha da app. */
  basis: 'ACSM 2009' | 'app';
}

export const LOAD_RULES = {
  stepMin: 0.02,
  stepMax: 0.1,
  /** Escolha da app: alvo dentro do intervalo nos multiarticulares. */
  compoundTarget: 0.06,
  /** Escolha da app: RIR médio que dispensa a segunda sessão no topo. */
  rirSkip: 4,
  /** Escolha da app: repetições extra antes de um salto acima de 10%. */
  extraReps: 3,
} as const;

const r2 = (x: number): number => Math.round(x * 100) / 100;
const EPS = 1e-9;

function topWeight(s: PastSession): number | null {
  const ws = s.sets.map((x) => x.weightKg ?? 0).filter((w) => w > 0);
  return ws.length ? Math.max(...ws) : null;
}
function topSets(s: PastSession, w: number): LoadSet[] {
  return s.sets.filter((x) => (x.weightKg ?? 0) === w && x.reps !== null);
}
const allAtLeast = (sets: LoadSet[], n: number) => sets.length > 0 && sets.every((x) => (x.reps ?? 0) >= n);
const allBelow = (sets: LoadSet[], n: number) => sets.length > 0 && sets.every((x) => (x.reps ?? 0) < n);
function avgRir(sets: LoadSet[]): number | null {
  const v = sets.map((x) => x.rir).filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
const kg = (x: number) => `${String(r2(x)).replace('.', ',')} kg`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Faixa do exercício: mínimo e máximo do treino; só um alvo → alvo ± 2 (escolha da app); nada → a do objetivo. */
export function repRange(t: { targetRepsMin: number | null; targetReps: number | null }, fallback: [number, number] = [8, 12]): [number, number] {
  if (t.targetReps && t.targetRepsMin) return [Math.min(t.targetRepsMin, t.targetReps), Math.max(t.targetRepsMin, t.targetReps)];
  if (t.targetReps) return [Math.max(1, t.targetReps - 2), t.targetReps + 2];
  return fallback;
}

/** Cargas possíveis no intervalo [lo, hi] a partir de w, de incremento em incremento. */
export function loadOptions(w: number, inc: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < 200; k++) {
    const x = r2(w + k * inc);
    if (x > hi + EPS) break;
    if (x >= lo - EPS) out.push(x);
  }
  return out;
}

export function suggestLoad(input: LoadInput): LoadSuggestion {
  const { history, repsMin: min, repsMax: max, mechanic, incrementKg: inc } = input;
  const base = { options: [] as number[], rangeKg: null as [number, number] | null, repsMin: min, repsMax: max };
  const s0 = history[0];
  const w = s0 ? topWeight(s0) : null;
  if (!s0 || w === null) {
    return {
      ...base, action: 'start', weightKg: null, basis: 'app',
      reason: `Primeira vez: escolhe uma carga com que faças ${min}–${max} repetições e fiques a 1–3 da falha.`,
    };
  }
  const t0 = topSets(s0, w);
  const s1 = history[1];
  const t1 = s1 && topWeight(s1) === w ? topSets(s1, w) : [];
  const top0 = allAtLeast(t0, max);
  const top1 = allAtLeast(t1, max);
  const rir0 = avgRir(t0);
  const easy = top0 && rir0 !== null && rir0 >= LOAD_RULES.rirSkip;

  if (top0 && (top1 || easy)) {
    const lo = r2(w * (1 + LOAD_RULES.stepMin));
    const hi = r2(w * (1 + LOAD_RULES.stepMax));
    const why = top1 ? `${max} repetições em 2 sessões seguidas` : `${max} repetições com ${Math.round(rir0!)}+ em reserva`;
    if (inc === null) {
      return {
        ...base, action: 'increase', weightKg: null, rangeKg: [lo, hi], repsMin: min, repsMax: max, basis: 'ACSM 2009',
        reason: `${why}: sobe para ${kg(lo)}–${kg(hi)} (define o incremento do equipamento para a app escolher).`,
      };
    }
    const options = loadOptions(w, inc, lo, hi);
    if (options.length) {
      const target = w * (1 + LOAD_RULES.compoundTarget);
      const pick = mechanic === 'ISOLATION'
        ? options[0]
        : options.reduce((b, x) => (Math.abs(x - target) < Math.abs(b - target) - EPS ? x : b), options[0]);
      return {
        ...base, action: 'increase', weightKg: pick, options, rangeKg: [lo, hi], repsMin: min, repsMax: max, basis: 'ACSM 2009',
        reason: `${why}: sobe ${pct((pick - w) / w)} para ${kg(pick)}.`,
      };
    }
    // O menor salto passa os 10%: primeiro mais repetições (escolha da app), depois o salto.
    const next = r2(w + inc);
    const extra = max + LOAD_RULES.extraReps;
    if (allAtLeast(t0, extra)) {
      return {
        ...base, action: 'increase', weightKg: next, rangeKg: [lo, hi], repsMin: min, repsMax: max, basis: 'app',
        reason: `Já fazes ${extra} repetições: passa a ${kg(next)} (+${pct(inc / w)}, acima dos 10% por causa do incremento).`,
      };
    }
    return {
      ...base, action: 'reps', weightKg: w, rangeKg: [lo, hi], repsMin: max + 1, repsMax: extra, basis: 'app',
      reason: `O próximo salto (${kg(next)}, +${pct(inc / w)}) passa os 10%: mantém ${kg(w)} e sobe até ${extra} repetições.`,
    };
  }

  if (allBelow(t0, min) && allBelow(t1, min)) {
    const down = inc ? r2(Math.max(0, w - inc)) : r2(Math.round(w * 0.95 * 2) / 2);
    return {
      ...base, action: 'decrease', weightKg: down, basis: 'app',
      reason: `Abaixo de ${min} repetições em 2 sessões: baixa para ${kg(down)} e volta a subir.`,
    };
  }

  return {
    ...base, action: 'hold', weightKg: w, basis: 'app',
    reason: top0
      ? `Chegaste a ${max} repetições: repete ${kg(w)}; se voltares ao topo, sobe.`
      : `Mantém ${kg(w)} e tenta mais 1 repetição até ${max}.`,
  };
}
