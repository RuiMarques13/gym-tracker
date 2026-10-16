import { inject, Injectable } from '@angular/core';
import { CYCLE_REPOSITORY, EXERCISE_REPOSITORY, SCHEDULED_REPOSITORY, SESSION_REPOSITORY, WORKOUT_REPOSITORY } from '../repositories';
import type { ScheduledWorkout } from '../../data/models/scheduled';
import { specOfMuscleIds } from '../../core/metrics/muscles';
import { conflictKey, daysOf, desiredDays, diffSchedule, slotOfDay, type DesiredDay } from '../../core/progression/cycle-schedule';
import type { ConflictChoice } from '../../core/progression/cycles';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../clock';
import { fromLocalDate, toLocalDate } from '../../core/util/week';
import { activeCycle, applyProposal, positionOn, weekReps, type Cycle, type CyclePosition, type NextBlockProposal } from '../../core/progression/cycles';
import { ProgressionService } from './progression.service';
import { rangeOptions } from '../../core/progression/stagnation';

export interface ActiveCycle {
  cycle: Cycle;
  pos: CyclePosition;
}

export interface ScheduleConflict {
  cycleId: string;
  day: DesiredDay;
  cycleName: string;
  mine: ScheduledWorkout[];
}

export interface BlockEndSummary {
  key: string;
  cycle: Cycle;
  pos: CyclePosition;
  nextBlockIndex: number;
  stagnated: number;
  /** Proposta recomendada e as alternativas. */
  recommended: NextBlockProposal;
  options: { label: string; proposal: NextBlockProposal }[];
  text: string;
}

/** Ciclos: o ativo hoje, a semana em curso e o resumo de fim de mesociclo. */
@Injectable({ providedIn: 'root' })
export class CycleService {
  private readonly repo = inject(CYCLE_REPOSITORY);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly progression = inject(ProgressionService);
  private readonly clock = inject(CLOCK);
  private readonly scheduled = inject(SCHEDULED_REPOSITORY);
  private readonly workouts = inject(WORKOUT_REPOSITORY);
  private readonly exercises = inject(EXERCISE_REPOSITORY);

  // --- semana-tipo → Planeados -------------------------------------------------------------------------

  /**
   * Põe os Planeados de acordo com a semana-tipo do ciclo, de hoje em diante. Devolve os conflitos com planeados
   * teus que ainda não decidiste (a app pergunta e chama `resolve`).
   */
  async syncSchedule(cycleId: string): Promise<ScheduleConflict[]> {
    const c = await this.repo.get(cycleId);
    if (!c) return [];
    const from = toLocalDate(this.clock.now());
    const desired = c.archivedAt ? [] : desiredDays(c, from);
    const state = await this.scheduled.cycleState(c.id, desired.map((d) => d.id));
    const last = desired.length ? desired[desired.length - 1].date : from;
    const existing = await this.scheduled.list(from, last);
    const diff = diffSchedule(c.id, desired, state, existing, c.plan.resolved ?? {}, from);
    for (const id of diff.remove) await this.scheduled.removeFromCycle(id);
    for (const id of diff.removeMine) await this.scheduled.remove(id);
    for (const d of diff.create) await this.scheduled.upsertFromCycle(d.id, d.date, d.templateId, c.id);
    const names = new Map((await this.workouts.list({ includeArchived: true })).map((w) => [w.id, w.name]));
    return diff.conflicts.map((x) => ({ cycleId: c.id, day: x.day, cycleName: names.get(x.day.templateId) ?? 'Treino', mine: x.mine }));
  }

  /** Guarda a tua escolha num conflito e volta a sincronizar. */
  async resolve(conflict: ScheduleConflict, choice: ConflictChoice): Promise<ScheduleConflict[]> {
    const c = await this.repo.get(conflict.cycleId);
    if (!c) return [];
    const plan = { ...c.plan, resolved: { ...(c.plan.resolved ?? {}), [conflictKey(conflict.day.date, conflict.day.templateId)]: choice } };
    await this.repo.save({ id: c.id, name: c.name, goal: c.goal, template: c.template, startDate: c.startDate, notes: c.notes, plan });
    return this.syncSchedule(c.id);
  }

  /** Tira os planeados futuros (por fazer) que este ciclo criou. */
  async removeFutureSchedule(cycleId: string): Promise<number> {
    const from = toLocalDate(this.clock.now());
    const rows = (await this.scheduled.cycleState(cycleId, [])).filter((r) => r.cycleId === cycleId && !r.deleted && r.status === 'PLANNED' && r.date >= from);
    for (const r of rows) await this.scheduled.remove(r.id);
    return rows.length;
  }

  /** Músculos principais (ids do spec) de cada treino, para o aviso de frequência. */
  async workoutMuscles(): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    const cache = new Map<string, string[]>();
    for (const w of await this.workouts.list()) {
      const full = await this.workouts.get(w.id);
      const muscles: string[] = [];
      for (const it of full?.items ?? []) {
        if (it.exerciseKind !== 'STRENGTH') continue;
        if (!cache.has(it.exerciseId)) cache.set(it.exerciseId, specOfMuscleIds((await this.exercises.get(it.exerciseId))?.primaryMuscleIds ?? []));
        muscles.push(...cache.get(it.exerciseId)!);
      }
      out.set(w.id, muscles);
    }
    return out;
  }

  async active(): Promise<ActiveCycle | null> {
    const today = toLocalDate(this.clock.now());
    const c = activeCycle(await this.repo.list(), today);
    const pos = c ? positionOn(c, today) : null;
    return c && pos ? { cycle: c, pos } : null;
  }

  /** Faixa da semana para a sessão `sessionId` (ondulatório: pela ordem das sessões de força desta semana). */
  async repsFor(a: ActiveCycle, sessionId: string): Promise<[number, number] | null> {
    if (!a.pos.week.undulating?.length) return a.pos.week.reps;
    // Com semana-tipo: a faixa vai pela posição do dia (1.º treino da semana, 2.º, …).
    const today = toLocalDate(this.clock.now());
    const slot = slotOfDay(daysOf(a.pos.block, a.pos.week), (fromLocalDate(today).getDay() + 6) % 7);
    if (slot !== null) return weekReps(a.pos.week, slot);
    const done = (await this.sessions.listFinished({ limit: 30 }))
      .filter((s) => s.id !== sessionId && toLocalDate(new Date(s.startedAt)) >= a.pos.weekStart && s.setCount > 0).length;
    return weekReps(a.pos.week, done);
  }

  /** Na última semana de um mesociclo (com outro a seguir): resumo e proposta para o seguinte. */
  async blockEnd(): Promise<BlockEndSummary | null> {
    const a = await this.active();
    if (!a || !a.pos.lastOfBlock || a.pos.blockIndex + 1 >= a.cycle.plan.blocks.length) return null;
    const key = `cycle:${a.cycle.id}:${a.pos.blockIndex}`;
    if (this.settings.get('dismissedNotices')().includes(key)) return null;
    const cards = await this.progression.cards({ all: true });
    const stagnated = cards.filter((c) => c.kind === 'STAGNATION').length;
    const atMax = cards.some((c) => c.response === 'range' || c.response === 'swap');
    const next = a.cycle.plan.blocks[a.pos.blockIndex + 1];
    const reps = next.weeks.find((w) => w.reps)?.reps ?? [8, 12];
    const [alt] = rangeOptions(reps[0], reps[1]);
    const options: BlockEndSummary['options'] = [
      { label: 'Repetir como está', proposal: { kind: 'repeat' } },
      { label: '+10% de séries', proposal: { kind: 'more-volume', factor: 1.1 } },
      { label: `Faixa ${alt[0]}–${alt[1]}`, proposal: { kind: 'range', reps: alt } },
    ];
    const recommended = !stagnated ? options[0].proposal : atMax ? options[2].proposal : options[1].proposal;
    const text = stagnated
      ? `Fim de «${a.pos.block.name}»: ${stagnated} ${stagnated === 1 ? 'exercício estagnado' : 'exercícios estagnados'}. Para «${next.name}» a app propõe ${atMax ? 'mudar de faixa' : 'mais 10% de séries'}.`
      : `Fim de «${a.pos.block.name}»: sem exercícios estagnados. Para «${next.name}» a app propõe repetir.`;
    return { key, cycle: a.cycle, pos: a.pos, nextBlockIndex: a.pos.blockIndex + 1, stagnated, recommended, options, text };
  }

  async applyBlockEnd(s: BlockEndSummary, p: NextBlockProposal): Promise<void> {
    if (p.kind !== 'repeat') {
      const c = s.cycle;
      await this.repo.save({ id: c.id, name: c.name, goal: c.goal, template: c.template, startDate: c.startDate, notes: c.notes, plan: applyProposal(c.plan, s.nextBlockIndex, p) });
    }
    const cur = this.settings.get('dismissedNotices')();
    await this.settings.set('dismissedNotices', [...cur, s.key].slice(-200));
  }
}
