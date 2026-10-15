import { ids } from '../util/uuid';
import { addDays, weekStartOf } from '../util/week';
import type { CycleScheduledRow } from '../../data/repositories/scheduled.repository';
import type { ScheduledWorkout } from '../../data/models/scheduled';
import type { Cycle, CycleBlock, CycleWeek, ConflictChoice } from './cycles';

/**
 * Da semana-tipo aos Planeados (pedido de 15/10: semana-tipo por mesociclo com exceções, Planeados automáticos,
 * conflitos perguntados, descarga com os mesmos dias).
 *
 * Regras:
 * - Só mexe de `from` (hoje) em diante, e só em planeados do ciclo ainda por fazer.
 * - Planeado do ciclo que apagaste: não volta. Planeado do ciclo que moveste: passou a teu, não volta a ser mexido.
 * - Um planeado teu no mesmo dia com outro treino é um conflito: a app pergunta (fica o teu, o do ciclo, ou os dois).
 *   Com o mesmo treino, não há conflito e o ciclo não duplica.
 */
export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export interface DesiredDay {
  id: string;
  date: string;
  templateId: string;
}

/** Os dias desta semana: a exceção da semana, senão a semana-tipo do mesociclo; null se nenhuma está definida. */
export function daysOf(block: CycleBlock, week: CycleWeek): (string | null)[] | null {
  return week.days ?? block.pattern ?? null;
}

export function desiredDays(c: Pick<Cycle, 'id' | 'startDate' | 'plan'>, from: string): DesiredDay[] {
  const out: DesiredDay[] = [];
  let monday = weekStartOf(c.startDate);
  for (const b of c.plan.blocks) {
    for (const w of b.weeks) {
      const days = daysOf(b, w);
      days?.forEach((t, i) => {
        const date = addDays(monday, i);
        if (t && date >= from) out.push({ id: ids.cycleScheduled(c.id, date, t), date, templateId: t });
      });
      monday = addDays(monday, 7);
    }
  }
  return out;
}

export const conflictKey = (date: string, templateId: string) => `${date}|${templateId}`;

export interface ScheduleDiff {
  create: DesiredDay[];
  /** Planeados do ciclo que já não fazem parte da semana-tipo (ids). */
  remove: string[];
  /** Planeados teus a apagar porque escolheste «fica o do ciclo». */
  removeMine: string[];
  /** Conflitos ainda por decidir. */
  conflicts: { day: DesiredDay; mine: ScheduledWorkout[] }[];
}

export function diffSchedule(
  cycleId: string,
  desired: DesiredDay[],
  state: CycleScheduledRow[],
  /** Planeados (não apagados) nas datas do ciclo, de hoje em diante. */
  existing: ScheduledWorkout[],
  resolved: Record<string, ConflictChoice>,
  from: string,
): ScheduleDiff {
  const byId = new Map(state.map((r) => [r.id, r]));
  const want = new Set(desired.map((d) => d.id));
  const diff: ScheduleDiff = { create: [], remove: [], removeMine: [], conflicts: [] };

  for (const r of state) {
    if (r.cycleId === cycleId && !r.deleted && r.status === 'PLANNED' && r.date >= from && !want.has(r.id)) diff.remove.push(r.id);
  }
  for (const d of desired) {
    const r = byId.get(d.id);
    if (r && !r.deleted && r.cycleId === cycleId) continue; // já lá está
    if (r && r.deleted && r.cycleId === cycleId) continue; // apagaste-o: não volta
    if (r && !r.deleted && r.cycleId === null) continue; // moveste-o: é teu
    const mine = existing.filter((e) => e.date === d.date && e.cycleId === null && e.status === 'PLANNED' && e.id !== d.id);
    if (mine.some((e) => e.templateId === d.templateId)) continue; // o mesmo treino já está planeado à mão
    if (mine.length) {
      const choice = resolved[conflictKey(d.date, d.templateId)];
      if (!choice) { diff.conflicts.push({ day: d, mine }); continue; }
      if (choice === 'mine') continue;
      if (choice === 'cycle') diff.removeMine.push(...mine.map((e) => e.id));
    }
    diff.create.push(d);
  }
  return diff;
}

/** Grandes grupos (ACSM 2026, comunicado: todos os grupos grandes pelo menos 2× por semana). */
export const BIG_GROUPS = ['peito', 'costas_dorsais', 'costas_superiores', 'quadriceps', 'isquiotibiais', 'gluteos'] as const;

/**
 * Grandes grupos que a semana-tipo treina só 1× por semana (como músculo principal de algum exercício).
 * `muscles`: para cada treino, os músculos principais (ids do spec) dos seus exercícios.
 */
export function frequencyWarnings(days: (string | null)[], muscles: Map<string, string[]>): string[] {
  const count = new Map<string, number>();
  for (const t of days) {
    if (!t) continue;
    for (const m of new Set(muscles.get(t) ?? [])) count.set(m, (count.get(m) ?? 0) + 1);
  }
  return BIG_GROUPS.filter((m) => count.get(m) === 1);
}

/** Ondulatório: posição deste dia entre os dias de treino da semana (0-based), ou null se hoje não está na semana-tipo. */
export function slotOfDay(days: (string | null)[] | null, weekday: number): number | null {
  if (!days || !days[weekday]) return null;
  return days.slice(0, weekday).filter(Boolean).length;
}
