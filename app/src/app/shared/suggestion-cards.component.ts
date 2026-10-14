import { Component, inject, input, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular';
import { ProgressionService, type Notice, type SuggestionCard, type SuggestionOption } from '../core/progression/progression.service';
import { ToastService } from '../core/ui/toast.service';
import { RuleWhyComponent } from './rule-why.component';

/**
 * Cartões de estagnação e fadiga, com a resposta sugerida, o «Porquê?» com as regras e as fontes, e os botões
 * aceitar e «Agora não». Aceitar aplica a resposta (treinos ou semana de descarga); recusar esconde até nova deteção.
 */
@Component({
  selector: 'app-suggestion-cards',
  imports: [IonButton, RuleWhyComponent],
  template: `
    @for (c of cards(); track c.key) {
      <div class="card" [class.fatigue]="c.response === 'deload'">
        <strong class="title">{{ c.title }}</strong>
        <p class="text">{{ c.text }}</p>
        @if (c.signals.length) {
          <ul class="signals">@for (s of c.signals; track s) { <li>{{ s }}</li> }</ul>
        }
        @if (c.options.length) {
          <div class="opts">
            @for (o of c.options; track o.label) {
              <button type="button" [class.on]="picked()[c.key] === o" (click)="pick(c, o)">{{ o.label }}</button>
            }
          </div>
        }
        <div class="actions">
          <ion-button size="small" [disabled]="busy() || (c.options.length > 0 && !picked()[c.key])" (click)="accept(c)">{{ c.acceptLabel }}</ion-button>
          <ion-button size="small" fill="clear" color="medium" [disabled]="busy()" (click)="decline(c)">Agora não</ion-button>
          <button type="button" class="whybtn" (click)="toggleWhy(c.key)">{{ why() === c.key ? 'Fechar' : 'Porquê?' }}</button>
        </div>
        @if (why() === c.key) {
          <div class="why">
            @for (r of c.rules; track r) { <app-rule-why [key]="r" /> }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .card { padding: 12px 14px; border-radius: 12px; margin: 0 0 10px; background: rgba(var(--ion-color-warning-rgb), .12); }
    .card.fatigue { background: rgba(var(--ion-color-tertiary-rgb, 128,128,128), .12); }
    .title { display: block; font-size: 15px; }
    .text { margin: 4px 0 0; font-size: 14px; line-height: 1.45; }
    .signals { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: var(--ion-color-medium); }
    .opts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .opts button { font: inherit; font-size: 13px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--ion-color-medium); background: none; color: inherit; }
    .opts button.on { border-color: var(--ion-color-primary); background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
    .whybtn { font: inherit; font-size: 13px; font-weight: 600; border: 0; background: none; color: var(--ion-color-primary); margin-left: auto; padding: 4px; }
    .why { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(128,128,128,.25); }
  `,
})
export class SuggestionCardsComponent {
  private readonly progression = inject(ProgressionService);
  private readonly toasts = inject(ToastService);
  readonly cards = input<SuggestionCard[]>([]);
  /** Depois de aceitar ou recusar: o ecrã volta a pedir os cartões. */
  readonly changed = output<void>();
  readonly why = signal<string | null>(null);
  readonly busy = signal(false);
  readonly picked = signal<Record<string, SuggestionOption>>({});

  pick(c: SuggestionCard, o: SuggestionOption): void {
    this.picked.update((p) => ({ ...p, [c.key]: o }));
  }
  toggleWhy(key: string): void {
    this.why.update((k) => (k === key ? null : key));
  }

  async accept(c: SuggestionCard): Promise<void> {
    this.busy.set(true);
    try {
      const msg = await this.progression.accept(c, this.picked()[c.key]);
      await this.toasts.success(msg, 3200);
      this.changed.emit();
    } catch (e) {
      await this.toasts.error(e instanceof Error ? e.message : 'Não foi possível aplicar.');
    } finally {
      this.busy.set(false);
    }
  }

  async decline(c: SuggestionCard): Promise<void> {
    this.busy.set(true);
    try {
      await this.progression.decline(c);
      this.changed.emit();
    } finally {
      this.busy.set(false);
    }
  }
}

/** Avisos informativos (ritmo de peso, nível sugerido), com «Porquê?», a ação opcional e «OK». */
@Component({
  selector: 'app-notice-cards',
  imports: [IonButton, RuleWhyComponent],
  template: `
    @for (n of notices(); track n.key) {
      <div class="card info">
        <strong class="title">{{ n.title }}</strong>
        <p class="text">{{ n.text }}</p>
        <div class="actions">
          @if (n.action) { <ion-button size="small" (click)="accept(n)">{{ n.action.label }}</ion-button> }
          <ion-button size="small" [fill]="n.action ? 'clear' : 'outline'" [color]="n.action ? 'medium' : 'primary'" (click)="dismiss(n)">{{ n.action ? 'Agora não' : 'OK' }}</ion-button>
          <button type="button" class="whybtn" (click)="why.set(why() === n.key ? null : n.key)">{{ why() === n.key ? 'Fechar' : 'Porquê?' }}</button>
        </div>
        @if (why() === n.key) {
          <div class="why">@for (r of n.rules; track r) { <app-rule-why [key]="r" /> }</div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .card { padding: 12px 14px; border-radius: 12px; margin: 0 0 10px; background: rgba(var(--ion-color-primary-rgb), .1); }
    .title { display: block; font-size: 15px; }
    .text { margin: 4px 0 0; font-size: 14px; line-height: 1.45; }
    .actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
    .whybtn { font: inherit; font-size: 13px; font-weight: 600; border: 0; background: none; color: var(--ion-color-primary); margin-left: auto; padding: 4px; }
    .why { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(128,128,128,.25); }
  `,
})
export class NoticeCardsComponent {
  private readonly progression = inject(ProgressionService);
  private readonly toasts = inject(ToastService);
  readonly notices = input<Notice[]>([]);
  readonly changed = output<void>();
  readonly why = signal<string | null>(null);

  async accept(n: Notice): Promise<void> {
    const msg = await this.progression.acceptNotice(n);
    if (msg) await this.toasts.success(msg);
    this.changed.emit();
  }
  async dismiss(n: Notice): Promise<void> {
    await this.progression.dismissNotice(n);
    this.changed.emit();
  }
}
