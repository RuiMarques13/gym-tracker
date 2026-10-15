import type { Goal } from '../metrics/volume';
import { addDays, weekStartOf } from '../util/week';

/**
 * Ciclos (especificação «Progressão e ciclos», fase 5): macrociclo → mesociclos (blocos) → semanas (microciclos).
 * Cada semana tem um tipo e três ajustes: faixa de repetições, multiplicador de séries e RIR alvo.
 * Os números dos templates são escolhas da app construídas a partir das fontes (ver rules.ts `cycle.*`); tudo editável.
 */
export type WeekType = 'normal' | 'overload' | 'deload' | 'test';
export type BlockFocus = 'base' | 'volume' | 'strength' | 'power' | 'endurance' | 'cut' | 'deload';
export type TemplateId = 'simple' | 'beginner' | 'volume' | 'linear' | 'undulating' | 'power' | 'endurance' | 'cut';

export interface CycleWeek {
  type: WeekType;
  /** Faixa de repetições da semana; null = a do treino. */
  reps: [number, number] | null;
  /** Ondulatório: uma faixa por treino da semana, pela ordem em que os fazes. */
  undulating?: [number, number][];
  /** Multiplicador das séries do treino (1 = como está). */
  sets: number;
  /** RIR alvo; null = o do nível. */
  rir: number | null;
}

export interface CycleBlock {
  name: string;
  focus: BlockFocus;
  weeks: CycleWeek[];
}

export interface CyclePlan {
  blocks: CycleBlock[];
}

export interface Cycle {
  id: string;
  name: string;
  goal: Goal;
  template: TemplateId;
  /** Segunda-feira da primeira semana («YYYY-MM-DD»). */
  startDate: string;
  plan: CyclePlan;
  notes: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

export const WEEK_LABEL: Record<WeekType, string> = { normal: 'Normal', overload: 'Sobrecarga', deload: 'Descarga', test: 'Teste' };
export const FOCUS_LABEL: Record<BlockFocus, string> = { base: 'Base', volume: 'Volume', strength: 'Força', power: 'Potência', endurance: 'Resistência', cut: 'Definição', deload: 'Descarga' };

const w = (type: WeekType, reps: [number, number] | null, sets: number, rir: number | null): CycleWeek => ({ type, reps, sets, rir });
const DELOAD = (reps: [number, number] | null = null): CycleWeek => w('deload', reps, 0.5, 3);

export interface TemplateDef {
  id: TemplateId;
  name: string;
  who: string;
  /** O que o template faz, numa frase. */
  text: string;
  goal: Goal;
  rule: string;
  blocks: CycleBlock[];
}

/** Templates de partida (tabela da especificação). */
export const TEMPLATES: TemplateDef[] = [
  {
    id: 'simple', name: 'Simples', who: 'Qualquer objetivo', goal: 'hypertrophy', rule: 'cycle.simple',
    text: 'Faixa fixa do treino, progressão de carga e repetições; descarga só quando a app deteta fadiga.',
    blocks: [1, 2, 3].map((i) => ({ name: `Bloco ${i}`, focus: 'base' as const, weeks: [1, 2, 3, 4].map(() => w('normal', null, 1, null)) })),
  },
  {
    id: 'beginner', name: 'Iniciante', who: 'Primeiros meses ou regresso', goal: 'hypertrophy', rule: 'cycle.beginner',
    text: '8–12 repetições, RIR 2–3 (a app marca 3 nas primeiras semanas), sem falha.',
    blocks: [1, 2, 3].map((i) => ({ name: `Base ${i}`, focus: 'base' as const, weeks: [w('normal', [8, 12], 1, 3), w('normal', [8, 12], 1, 3), w('normal', [8, 12], 1, 2), w('normal', [8, 12], 1, 2)] })),
  },
  {
    id: 'volume', name: 'Hipertrofia por volume', who: 'Intermédio ou avançado', goal: 'hypertrophy', rule: 'cycle.volume',
    text: 'Mesociclos de 4 semanas: volume habitual e RIR 3, depois a subir séries até +20% e RIR 1, e descarga na 4.ª.',
    blocks: [1, 2, 3].map((i) => ({ name: `Volume ${i}`, focus: 'volume' as const, weeks: [w('normal', null, 1, 3), w('overload', null, 1.1, 2), w('overload', null, 1.2, 1), DELOAD()] })),
  },
  {
    id: 'linear', name: 'Força linear', who: 'Quem quer força máxima', goal: 'strength', rule: 'cycle.linear',
    text: '3 mesociclos de 4 semanas: 8–12, depois 6–8, depois 3–6 repetições, cada um com descarga na última semana.',
    blocks: ([[8, 12], [6, 8], [3, 6]] as [number, number][]).map((r, i) => ({
      name: ['Base', 'Força', 'Pico'][i], focus: (i === 0 ? 'base' : 'strength') as BlockFocus,
      weeks: [w('normal', r, 1, 2), w('normal', r, 1, 2), w('overload', r, 1, 1), DELOAD(r)],
    })),
  },
  {
    id: 'undulating', name: 'Ondulatório', who: 'Quem treina o mesmo músculo 3× por semana', goal: 'strength', rule: 'cycle.undulating',
    text: 'Cada treino da semana com uma faixa diferente: 12–15, 8–10 e 4–6, por esta ordem.',
    blocks: [1, 2, 3].map((i) => ({
      name: `Ondulatório ${i}`, focus: 'strength' as const,
      weeks: [...[1, 2, 3].map((): CycleWeek => ({ ...w('normal', null, 1, 2), undulating: [[12, 15], [8, 10], [4, 6]] })), DELOAD()],
    })),
  },
  {
    id: 'power', name: 'Potência', who: 'Saltos, sprints, desporto', goal: 'power', rule: 'cycle.power',
    text: '3–6 repetições a 30–70% do 1RM, o mais rápido possível, longe da falha; descarga na 4.ª semana.',
    blocks: [1, 2, 3].map((i) => ({ name: `Potência ${i}`, focus: 'power' as const, weeks: [w('normal', [3, 6], 1, 3), w('normal', [3, 6], 1, 3), w('normal', [3, 6], 1, 3), DELOAD([3, 6])] })),
  },
  {
    id: 'endurance', name: 'Resistência muscular', who: 'Muitas repetições, carga leve', goal: 'endurance', rule: 'cycle.endurance',
    text: '12–15, depois 15–20, depois 15–25 repetições com carga leve; descarga na última semana de cada mesociclo.',
    blocks: ([[12, 15], [15, 20], [15, 25]] as [number, number][]).map((r, i) => ({
      name: `Resistência ${i + 1}`, focus: 'endurance' as const, weeks: [w('normal', r, 1, 2), w('normal', r, 1, 2), w('normal', r, 1, 1), DELOAD(r)],
    })),
  },
  {
    id: 'cut', name: 'Definição', who: 'Perda de gordura', goal: 'cut', rule: 'cycle.cut',
    text: 'Mantém treinos e cargas; sem descarga marcada (a app sugere se o desempenho cair 2 semanas); vigia o ritmo de peso.',
    blocks: [1, 2].map((i) => ({ name: `Definição ${i}`, focus: 'cut' as const, weeks: [1, 2, 3, 4].map(() => w('normal', null, 1, 2)) })),
  },
];
export const TEMPLATE: Record<TemplateId, TemplateDef> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<TemplateId, TemplateDef>;

/** Cópia profunda do plano do template (para o ciclo novo poder ser editado sem mexer no template). */
export function planFrom(template: TemplateId): CyclePlan {
  return JSON.parse(JSON.stringify({ blocks: TEMPLATE[template].blocks })) as CyclePlan;
}

export const totalWeeks = (plan: CyclePlan): number => plan.blocks.reduce((n, b) => n + b.weeks.length, 0);

/** Última segunda-feira do ciclo + 6 dias. */
export function endDate(c: Pick<Cycle, 'startDate' | 'plan'>): string {
  return addDays(c.startDate, totalWeeks(c.plan) * 7 - 1);
}

export interface CyclePosition {
  blockIndex: number;
  block: CycleBlock;
  /** 0-based dentro do bloco. */
  weekIndex: number;
  week: CycleWeek;
  /** 1-based no ciclo todo. */
  weekNumber: number;
  totalWeeks: number;
  /** Segunda-feira desta semana. */
  weekStart: string;
  lastOfBlock: boolean;
  /** Próxima semana de descarga (segunda-feira), se houver. */
  nextDeload: string | null;
}

/** Em que semana do ciclo cai `today`; null antes do início ou depois do fim. */
export function positionOn(c: Pick<Cycle, 'startDate' | 'plan'>, today: string): CyclePosition | null {
  const start = weekStartOf(c.startDate);
  const idx = Math.round((Date.parse(weekStartOf(today)) - Date.parse(start)) / (7 * 86_400_000));
  const total = totalWeeks(c.plan);
  if (idx < 0 || idx >= total) return null;
  let k = idx;
  for (let b = 0; b < c.plan.blocks.length; b++) {
    const block = c.plan.blocks[b];
    if (k < block.weeks.length) {
      let nextDeload: string | null = null;
      let n = 0;
      outer: for (let bb = 0; bb < c.plan.blocks.length; bb++) {
        for (const wk of c.plan.blocks[bb].weeks) {
          if (n > idx && wk.type === 'deload') { nextDeload = addDays(start, n * 7); break outer; }
          n++;
        }
      }
      return {
        blockIndex: b, block, weekIndex: k, week: block.weeks[k], weekNumber: idx + 1, totalWeeks: total,
        weekStart: addDays(start, idx * 7), lastOfBlock: k === block.weeks.length - 1, nextDeload,
      };
    }
    k -= block.weeks.length;
  }
  return null;
}

/** Faixa de repetições da semana para a n-ésima sessão da semana (0-based), ou null se manda a do treino. */
export function weekReps(week: CycleWeek, sessionIndex: number): [number, number] | null {
  if (week.undulating?.length) return week.undulating[sessionIndex % week.undulating.length];
  return week.reps;
}

/** Séries de um exercício nesta semana (arredondado, pelo menos 1). */
export function weekSets(week: CycleWeek, targetSets: number): number {
  return Math.max(1, Math.round(targetSets * week.sets));
}

/** O ciclo ativo hoje: o não arquivado que contém hoje (o mais recente se houver vários). */
export function activeCycle<T extends Pick<Cycle, 'startDate' | 'plan' | 'archivedAt' | 'updatedAt'>>(cycles: T[], today: string): T | null {
  return cycles
    .filter((c) => !c.archivedAt && positionOn(c, today))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null;
}

/**
 * Proposta para o mesociclo seguinte (resumo de fim de mesociclo). Escolhas da app a partir das respostas à
 * estagnação: com exercícios estagnados e volume abaixo do máximo, +10% de séries; já no máximo, outra faixa;
 * sem estagnação, repetir.
 */
export type NextBlockProposal = { kind: 'repeat' } | { kind: 'more-volume'; factor: number } | { kind: 'range'; reps: [number, number] };

export function applyProposal(plan: CyclePlan, blockIndex: number, p: NextBlockProposal): CyclePlan {
  const next = JSON.parse(JSON.stringify(plan)) as CyclePlan;
  const b = next.blocks[blockIndex];
  if (!b) return next;
  for (const wk of b.weeks) {
    if (wk.type === 'deload') continue;
    if (p.kind === 'more-volume') wk.sets = Math.round(wk.sets * p.factor * 100) / 100;
    if (p.kind === 'range') { wk.reps = p.reps; delete wk.undulating; }
  }
  return next;
}
