import { inject, Injectable, signal } from '@angular/core';
import { CLOCK } from '../clock';
import { CardioRun, parseRun, startRun } from '../../core/timer/cardio-run';

const KEY = 'gt.cardioRun';

/** A atividade de cardio em curso (uma de cada vez). Guarda-se no armazenamento local para sobreviver a fechar a app. */
@Injectable({ providedIn: 'root' })
export class CardioRunService {
  private readonly clock = inject(CLOCK);
  readonly run = signal<CardioRun | null>(this.load());

  begin(exerciseId: string, name: string): CardioRun {
    const cur = this.run();
    if (cur && cur.exerciseId === exerciseId) return cur;
    const r = startRun(exerciseId, name, this.clock.now().getTime());
    this.run.set(r);
    this.save(r);
    return r;
  }

  clear(): void {
    this.run.set(null);
    this.save(null);
  }

  private load(): CardioRun | null {
    try {
      return parseRun(localStorage.getItem(KEY), this.clock.now().getTime());
    } catch {
      return null;
    }
  }

  private save(r: CardioRun | null): void {
    try {
      if (r) localStorage.setItem(KEY, JSON.stringify(r));
      else localStorage.removeItem(KEY);
    } catch {
      /* sem armazenamento: a corrida só vive em memória */
    }
  }
}
