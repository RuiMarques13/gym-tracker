import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type { Session } from '../../data/models/session';
import { SESSION_REPOSITORY } from '../repositories';

/**
 * A sessão aberta (ou null), para a barra «Treino em curso».
 * Relê a base a cada navegação e quando a app volta ao primeiro plano: começar e terminar
 * um treino passa sempre por uma navegação, e outro dispositivo pode ter sincronizado entretanto.
 */
@Injectable({ providedIn: 'root' })
export class ActiveSessionService {
  private readonly repo = inject(SESSION_REPOSITORY);
  readonly session = signal<Session | null>(null);
  private seq = 0;

  constructor() {
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => void this.refresh());
    const onVisible = () => { if (document.visibilityState === 'visible') void this.refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
  }

  async refresh(): Promise<void> {
    const mine = ++this.seq;
    try {
      const s = await this.repo.getActive();
      if (mine === this.seq) this.session.set(s);
    } catch {
      /* base ainda a abrir: a próxima navegação tenta de novo */
    }
  }
}
