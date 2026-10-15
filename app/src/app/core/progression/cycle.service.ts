import { inject, Injectable } from '@angular/core';
import { CYCLE_REPOSITORY, SESSION_REPOSITORY } from '../../data/repositories/providers';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../util/clock';
import { toLocalDate } from '../util/week';
import { activeCycle, applyProposal, positionOn, weekReps, type Cycle, type CyclePosition, type NextBlockProposal } from './cycles';
import { ProgressionService } from './progression.service';
import { rangeOptions } from './stagnation';

export interface ActiveCycle {
  cycle: Cycle;
  pos: CyclePosition;
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

  async active(): Promise<ActiveCycle | null> {
    const today = toLocalDate(this.clock.now());
    const c = activeCycle(await this.repo.list(), today);
    const pos = c ? positionOn(c, today) : null;
    return c && pos ? { cycle: c, pos } : null;
  }

  /** Faixa da semana para a sessão `sessionId` (ondulatório: pela ordem das sessões de força desta semana). */
  async repsFor(a: ActiveCycle, sessionId: string): Promise<[number, number] | null> {
    if (!a.pos.week.undulating?.length) return a.pos.week.reps;
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
