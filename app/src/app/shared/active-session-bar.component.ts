import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { IonIcon, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barbell, chevronForward } from 'ionicons/icons';
import type { Session } from '../data/models/session';
import { activeBarInfo } from '../core/session/active-bar';
import { CLOCK } from '../services/clock';

/** Barra fina por cima dos separadores com o treino aberto; tocar volta à sessão. */
@Component({
  selector: 'app-active-session-bar',
  imports: [IonIcon],
  template: `
    <button type="button" class="bar" [class.stale]="info().stale" (click)="open()"
      [attr.aria-label]="(info().stale ? 'Treino por terminar: ' : 'Treino em curso: ') + info().name + '. Voltar ao treino'">
      <ion-icon name="barbell" class="dot" aria-hidden="true" />
      <span class="txt">
        <strong>{{ info().stale ? 'Treino por terminar' : 'Treino em curso' }}</strong>
        <span>
          {{ info().name }}
          @if (!info().stale) { · {{ info().elapsed }} }
          · {{ info().sets }} {{ info().sets === 1 ? 'série' : 'séries' }}
        </span>
      </span>
      <ion-icon name="chevron-forward" class="go" aria-hidden="true" />
    </button>
  `,
  styles: `
    :host { display: block; flex: none; }
    .bar {
      display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 6px 14px;
      border: 0; border-top: 2px solid rgba(0, 0, 0, 0.08); font: inherit; text-align: left; cursor: pointer;
      background: var(--ion-color-primary); color: var(--ion-color-primary-contrast);
      -webkit-tap-highlight-color: transparent;
    }
    .bar.stale { background: var(--ion-color-warning); color: var(--ion-color-warning-contrast); }
    .bar:active { filter: brightness(0.92); }
    .bar:focus-visible { outline: 3px solid var(--ion-color-dark); outline-offset: -3px; }
    .dot { font-size: 20px; flex: none; }
    .txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
    .txt strong { font-size: 0.95rem; }
    .txt span { font-size: 0.8rem; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .go { margin-left: auto; font-size: 20px; flex: none; }
  `,
})
export class ActiveSessionBarComponent {
  private readonly nav = inject(NavController);
  private readonly clock = inject(CLOCK);
  readonly session = input.required<Session>();

  /** O tempo mostrado é ao minuto: basta acordar a cada 20 s. */
  private readonly now = signal(this.clock.now().getTime());
  readonly info = computed(() => activeBarInfo(this.session(), this.now()));

  constructor() {
    addIcons({ barbell, chevronForward });
    const id = setInterval(() => this.now.set(this.clock.now().getTime()), 20_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  open(): void {
    void this.nav.navigateForward('/sessao');
  }
}
