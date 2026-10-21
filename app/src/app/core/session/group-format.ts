import type { GroupConfig, GroupKind } from '../../data/models/group';

export type { GroupConfig, GroupKind } from '../../data/models/group';

/**
 * Formatos de grupo (superset, circuito e treinos por tempo): valores por defeito, validação, rótulo e o plano de
 * fases do temporizador. Regras e fontes em rules.ts (`groups.*`).
 */

export const GROUP_KINDS: readonly GroupKind[] = ['SUPERSET', 'CIRCUIT', 'TABATA', 'EMOM', 'AMRAP', 'INTERVALS'];
export const TIMED_KINDS: readonly GroupKind[] = ['TABATA', 'EMOM', 'AMRAP', 'INTERVALS'];
export const isTimed = (k: GroupKind | null | undefined): boolean => !!k && TIMED_KINDS.includes(k);

export const GROUP_LABEL: Record<GroupKind, string> = {
  SUPERSET: 'Superset',
  CIRCUIT: 'Circuito',
  TABATA: 'Tabata',
  EMOM: 'EMOM',
  AMRAP: 'AMRAP',
  INTERVALS: 'Intervalos',
};

export const GROUP_HINT: Record<GroupKind, string> = {
  SUPERSET: 'Exercícios seguidos sem descanso; descansas depois do último.',
  CIRCUIT: 'Voltas aos exercícios sem descanso entre eles; descansas no fim de cada volta.',
  TABATA: '20 s de trabalho e 10 s de descanso, 8 rondas, os exercícios à vez.',
  EMOM: 'No início de cada minuto fazes as repetições; descansas o resto do minuto.',
  AMRAP: 'O máximo de voltas no tempo marcado.',
  INTERVALS: 'Trabalho e descanso à tua medida, os exercícios à vez.',
};

/**
 * Valores por defeito. Tabata 20/10 × 8: protocolo de Tabata 1996 (`groups.tabata`). Os outros são escolha da app
 * (`groups.defaults`): EMOM 10 min, AMRAP 12 min, intervalos 40/20 × 8, circuito 3 voltas com 90 s entre voltas.
 */
export const GROUP_DEFAULTS: Record<GroupKind, GroupConfig> = {
  SUPERSET: { kind: 'SUPERSET', rounds: null, roundRestSeconds: null, workSeconds: null, restSeconds: null, durationSeconds: null },
  CIRCUIT: { kind: 'CIRCUIT', rounds: 3, roundRestSeconds: 90, workSeconds: null, restSeconds: null, durationSeconds: null },
  TABATA: { kind: 'TABATA', rounds: 8, roundRestSeconds: null, workSeconds: 20, restSeconds: 10, durationSeconds: null },
  EMOM: { kind: 'EMOM', rounds: 10, roundRestSeconds: null, workSeconds: 60, restSeconds: 0, durationSeconds: null },
  AMRAP: { kind: 'AMRAP', rounds: null, roundRestSeconds: null, workSeconds: null, restSeconds: null, durationSeconds: 720 },
  INTERVALS: { kind: 'INTERVALS', rounds: 8, roundRestSeconds: null, workSeconds: 40, restSeconds: 20, durationSeconds: null },
};

/** Limites para não aceitar valores absurdos (escolha da app). */
export const GROUP_LIMITS = {
  rounds: [1, 50],
  roundRestSeconds: [0, 600],
  workSeconds: [5, 600],
  restSeconds: [0, 600],
  durationSeconds: [60, 3600],
} as const;

const clampInt = (v: number | null, [lo, hi]: readonly [number, number]): number | null =>
  v === null || !Number.isFinite(v) ? null : Math.min(hi, Math.max(lo, Math.round(v)));

/** Acerta uma configuração: só os campos do formato, dentro dos limites, com o valor por defeito quando falta. */
export function normalizeConfig(c: Partial<GroupConfig> & { kind: GroupKind }): GroupConfig {
  const d = GROUP_DEFAULTS[c.kind];
  const pick = (k: keyof typeof GROUP_LIMITS) => (d[k] === null ? null : clampInt(c[k] ?? d[k], GROUP_LIMITS[k]) ?? d[k]);
  const out: GroupConfig = {
    kind: c.kind, rounds: pick('rounds'), roundRestSeconds: pick('roundRestSeconds'), workSeconds: pick('workSeconds'),
    restSeconds: pick('restSeconds'), durationSeconds: pick('durationSeconds'),
  };
  if (c.kind === 'EMOM') { out.workSeconds = 60; out.restSeconds = 0; }
  return out;
}

/** «90 s» até 2 min, depois «2 min» ou «2:30». */
const mmss = (s: number) => (s === 0 ? '0 s' : s < 120 && s % 60 !== 0 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

/** Rótulo curto: «Tabata · 20 s / 10 s × 8», «Circuito · 3 voltas · 90 s entre voltas», «AMRAP · 12 min». */
export function groupLabel(c: GroupConfig): string {
  const n = GROUP_LABEL[c.kind];
  switch (c.kind) {
    case 'SUPERSET': return n;
    case 'CIRCUIT': return `${n} · ${c.rounds} voltas` + (c.roundRestSeconds ? ` · ${mmss(c.roundRestSeconds)} entre voltas` : '');
    case 'TABATA':
    case 'INTERVALS': return `${n} · ${mmss(c.workSeconds ?? 0)} / ${mmss(c.restSeconds ?? 0)} × ${c.rounds}`;
    case 'EMOM': return `${n} · ${c.rounds} min`;
    case 'AMRAP': return `${n} · ${mmss(c.durationSeconds ?? 0)}`;
  }
}

export interface Phase {
  kind: 'work' | 'rest';
  /** Início em segundos desde o começo. */
  start: number;
  seconds: number;
  /** 1.ª ronda = 1. */
  round: number;
  /** Exercício desta ronda (à vez); no AMRAP e no EMOM, todos (−1). */
  exercise: number;
}

/**
 * Fases do temporizador de um formato por tempo. Tabata e intervalos: trabalho/descanso por ronda, os exercícios à
 * vez (sem descanso depois da última ronda). EMOM: um minuto por ronda. AMRAP: uma fase só.
 */
export function timedPlan(c: GroupConfig, exercises: number): Phase[] {
  const out: Phase[] = [];
  let t = 0;
  const n = Math.max(1, exercises);
  if (c.kind === 'AMRAP') return [{ kind: 'work', start: 0, seconds: c.durationSeconds ?? 0, round: 1, exercise: -1 }];
  if (c.kind === 'EMOM') {
    for (let r = 1; r <= (c.rounds ?? 0); r++, t += 60) out.push({ kind: 'work', start: t, seconds: 60, round: r, exercise: n > 1 ? (r - 1) % n : -1 });
    return out;
  }
  if (c.kind !== 'TABATA' && c.kind !== 'INTERVALS') return [];
  const rounds = c.rounds ?? 0;
  for (let r = 1; r <= rounds; r++) {
    out.push({ kind: 'work', start: t, seconds: c.workSeconds ?? 0, round: r, exercise: (r - 1) % n });
    t += c.workSeconds ?? 0;
    if (r < rounds && (c.restSeconds ?? 0) > 0) {
      out.push({ kind: 'rest', start: t, seconds: c.restSeconds ?? 0, round: r, exercise: r % n });
      t += c.restSeconds ?? 0;
    }
  }
  return out;
}

export const planSeconds = (plan: readonly Phase[]): number => (plan.length ? plan.at(-1)!.start + plan.at(-1)!.seconds : 0);

/** Onde vai o temporizador: fase atual, segundos que faltam nela, e se acabou. */
export function phaseAt(plan: readonly Phase[], elapsedSeconds: number): { index: number; remaining: number; done: boolean } {
  const total = planSeconds(plan);
  if (!plan.length || elapsedSeconds >= total) return { index: plan.length - 1, remaining: 0, done: true };
  const e = Math.max(0, elapsedSeconds);
  let i = plan.findIndex((p) => e < p.start + p.seconds);
  if (i < 0) i = plan.length - 1;
  return { index: i, remaining: Math.ceil(plan[i].start + plan[i].seconds - e), done: false };
}

/** Rondas completas até `elapsedSeconds` (para guardar quando paras antes do fim). */
export function roundsDone(plan: readonly Phase[], elapsedSeconds: number): number {
  return plan.filter((p) => p.kind === 'work' && p.start + p.seconds <= elapsedSeconds).length;
}
