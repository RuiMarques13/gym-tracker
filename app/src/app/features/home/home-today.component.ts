import { Component, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MUSCLE_LABEL } from '../../core/metrics/muscles';
import type { WeekDay } from '../../core/progression/today';
import { HomeTodayService } from '../../services/home/home-today.service';
import { CLOCK } from '../../services/clock';
import { RecoveryCardComponent } from '../../shared/recovery-card.component';
import { SessionLauncher } from '../session/session-launcher';

const LETTER = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const DAY_NAME = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/**
 * Home: o cartão «Hoje» (treino planeado, ou sugerido pela recuperação), a semana em 7 dias e dois cartões pequenos
 * (volume e recuperação). Calma e direta: um botão principal, o resto em atalhos.
 */
@Component({
  selector: 'app-home-today',
  imports: [RouterLink, RecoveryCardComponent],
  template: `
    @if (data.value(); as v) {
      @if (!active()) {
        <section class="today" aria-label="Hoje">
          <span class="eyebrow">HOJE</span>
          @if (v.workout; as w) {
            @if (v.suggested) {
              <h1>Sem treino planeado</h1>
              <p class="meta">Prontos para treinar, pela recuperação:</p>
            } @else {
              <h1>{{ w.name }}</h1>
              <p class="meta">{{ w.exercises }} {{ w.exercises === 1 ? 'exercício' : 'exercícios' }}@if (w.sets) { · {{ w.sets }} séries }@if (v.cycleLine) { · <a [routerLink]="['/ciclos', v.cycleId]">{{ v.cycleLine }}</a> }</p>
            }
            @if (w.muscles.length) {
              <ul class="chips" aria-label="Músculos do treino">
                @for (m of w.muscles.slice(0, 5); track m.muscle) {
                  <li [attr.aria-label]="label(m.muscle) + (m.hoursLeft > 0 ? ', a recuperar ' + wait(m.hoursLeft) : ', pronto')">
                    <span class="dot" [class.wait]="m.hoursLeft > 0" aria-hidden="true"></span>{{ label(m.muscle) }}@if (m.hoursLeft > 0) { · {{ wait(m.hoursLeft) }} }
                  </li>
                }
              </ul>
            }
            @if (v.suggested) {
              <p class="meta">Treino que encaixa: <strong>{{ w.name }}</strong>
                ({{ w.suggestedDaysAgo === null || w.suggestedDaysAgo === undefined ? 'ainda não feito' : w.suggestedDaysAgo === 0 ? 'feito hoje' : 'feito há ' + w.suggestedDaysAgo + (w.suggestedDaysAgo === 1 ? ' dia' : ' dias') }})</p>
            }
            <button type="button" class="go" (click)="launcher.start(w.templateId, w.scheduledId)">{{ v.suggested ? 'Começar ' + w.name : 'Começar treino' }}</button>
            <div class="links">
              <a routerLink="/treinos">Outro treino</a>
              <button type="button" class="link" (click)="launcher.start(null)">Sessão livre</button>
            </div>
          } @else if (v.doneToday) {
            <h1>Treino de hoje feito</h1>
            <p class="meta">Bom trabalho. Se quiseres mais, começa outra sessão.</p>
            <div class="links">
              <a routerLink="/treinos">Escolher um treino</a>
              <button type="button" class="link" (click)="launcher.start(null)">Sessão livre</button>
            </div>
          } @else {
            <h1>Sem treino planeado</h1>
            <p class="meta">{{ v.hasWorkouts ? 'Os teus treinos têm músculos ainda a recuperar.' : 'Ainda não tens treinos guardados.' }}</p>
            <button type="button" class="go" (click)="launcher.start(null)">Sessão livre</button>
            <div class="links">
              @if (v.hasWorkouts) { <a routerLink="/treinos">Escolher um treino</a> } @else { <a routerLink="/treinos/novo">Criar um treino</a> }
            </div>
          }
        </section>
      }

      <section class="card week" aria-label="Esta semana">
        <div class="head">
          <strong>Esta semana</strong>
          <span>{{ v.streak.thisWeek }} de {{ v.streak.goal }} treinos</span>
        </div>
        <ol class="days">
          @for (d of v.week; track d.date) {
            <li [attr.aria-label]="dayLabel(d)">
              <span class="letter" [class.now]="d.today" aria-hidden="true">{{ letters[d.weekday] }}</span>
              <span class="circle" [class]="'circle ' + d.kind" [class.now]="d.today" aria-hidden="true">
                @if (d.kind === 'done') {
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                }
              </span>
              <span class="name" aria-hidden="true">{{ d.name ?? (d.kind === 'done' ? 'Livre' : '') }}</span>
            </li>
          }
        </ol>
        @if (v.streak.weeks > 0) {
          <p class="foot">{{ v.streak.weeks }} {{ v.streak.weeks === 1 ? 'semana seguida' : 'semanas seguidas' }} a cumprir o objetivo</p>
        }
        @if (!v.anyPlanned) { <a class="foot-link" routerLink="/planeados">Planear a semana</a> }
      </section>

      <div class="minis">
        <a class="card mini" routerLink="/volume">
          <span class="mlabel">Volume · 7 dias</span>
          @if (v.volume; as vol) {
            <span class="big">{{ vol.inRange }}<small> de {{ vol.total }}</small></span>
            <span class="msub">músculos na faixa</span>
            <span class="bar"><span [style.width.%]="pct(vol.progress)"></span></span>
          } @else { <span class="msub">A calcular…</span> }
        </a>
        <button type="button" class="card mini" (click)="showRecovery.set(!showRecovery())" [attr.aria-expanded]="showRecovery()">
          <span class="mlabel">Recuperação</span>
          @if (v.recovery.recovering) {
            <span class="big">{{ v.recovery.recovering }}<small> a recuperar</small></span>
            @if (v.recovery.next; as n) { <span class="msub">{{ label(n.muscle) }} pronto {{ when(n.readyAt) }}</span> }
          } @else {
            <span class="big">Tudo<small> pronto</small></span>
            <span class="msub">Toca para indicar dor</span>
          }
        </button>
      </div>
      @if (showRecovery()) {
        <section class="card recovery" aria-label="Recuperação por músculo">
          <app-recovery-card [refresh]="refresh()" (changed)="data.reload()" />
        </section>
      }
    } @else {
      <div class="skeleton" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host { display: block; margin: 4px 0 16px; }
    .today { display: flex; flex-direction: column; gap: 10px; padding: 18px 18px 14px; border-radius: 20px;
      background: rgba(var(--ion-color-primary-rgb), .1); }
    .eyebrow { font-size: .8rem; font-weight: 800; letter-spacing: .08em; color: var(--ion-color-primary); }
    h1 { margin: 0; font-size: 1.85rem; line-height: 1.1; }
    .meta { margin: 0; font-size: .95rem; font-weight: 600; color: var(--ion-text-color); opacity: .82; }
    .meta a { color: inherit; }
    .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .chips li { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
      background: var(--ion-background-color, #fff); font-size: .9rem; font-weight: 700; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ion-color-success, #2dd36f); }
    .dot.wait { background: var(--gt-flame); }
    .go { margin-top: 4px; min-height: 56px; border: 0; border-radius: 16px; background: var(--ion-color-primary);
      color: var(--ion-color-primary-contrast); font: inherit; font-size: 1.1rem; font-weight: 800;
      box-shadow: 0 4px 0 color-mix(in srgb, var(--ion-color-primary) 62%, #000); transition: transform 80ms ease, box-shadow 80ms ease; }
    .go:active { transform: translateY(4px); box-shadow: none; }
    .links { display: flex; justify-content: center; gap: 22px; }
    .links a, .link { min-height: 44px; display: inline-flex; align-items: center; padding: 0 4px; border: 0; background: none;
      color: var(--ion-color-primary); font: inherit; font-size: .95rem; font-weight: 800; text-decoration: none; }
    .card { display: block; margin-top: 14px; padding: 14px; border: 2px solid var(--gt-line); border-radius: 18px;
      background: transparent; color: inherit; text-decoration: none; font: inherit; text-align: left; }
    .head { display: flex; align-items: baseline; gap: 8px; }
    .head strong { flex: 1; font-size: 1rem; font-weight: 900; }
    .head span { font-weight: 800; }
    .days { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
    .days li { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
    .letter { font-size: .75rem; font-weight: 800; color: var(--ion-color-medium); }
    .letter.now { color: var(--ion-text-color); font-weight: 900; }
    .circle { width: 30px; height: 30px; border-radius: 50%; box-sizing: border-box; display: grid; place-items: center; background: var(--gt-surface); }
    .circle.done { background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .circle.planned { background: transparent; border: 2px dashed var(--gt-line-press); }
    .circle.missed, .circle.skipped { background: var(--gt-line); }
    .circle.now:not(.done) { background: transparent; border: 3px solid var(--ion-color-primary); }
    .name { min-height: 1em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .7rem; font-weight: 700; color: var(--ion-color-medium); }
    .foot { margin: 10px 0 0; font-size: .9rem; font-weight: 700; color: var(--ion-color-medium); }
    .foot-link { display: inline-flex; min-height: 44px; align-items: center; margin-top: 2px; font-weight: 800; color: var(--ion-color-primary); text-decoration: none; }
    .minis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .mini { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; cursor: pointer; }
    .mlabel { font-size: .85rem; font-weight: 800; color: var(--ion-color-medium); }
    .big { font-size: 1.5rem; font-weight: 900; line-height: 1; }
    .big small { font-size: .9rem; font-weight: 700; color: var(--ion-color-medium); }
    .msub { font-size: .8rem; font-weight: 700; color: var(--ion-color-medium); }
    .bar { height: 8px; border-radius: 999px; background: var(--gt-line); overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--ion-color-primary); }
    .recovery { padding: 12px; }
    .skeleton { height: 260px; border-radius: 20px; background: var(--gt-surface); }
    @media (prefers-reduced-motion: reduce) { .go { transition: none; } }
  `,
})
export class HomeTodayComponent {
  private readonly service = inject(HomeTodayService);
  private readonly clock = inject(CLOCK);
  readonly launcher = inject(SessionLauncher);

  /** Muda para recarregar (a Home sobe-o em cada entrada). */
  readonly refresh = input(0);
  /** Há uma sessão em curso: a Home mostra «Continuar» em vez do cartão «Hoje». */
  readonly active = input(false);
  readonly showRecovery = signal(false);
  readonly letters = LETTER;
  readonly data = resource({ params: () => ({ r: this.refresh() }), loader: () => this.service.load() });

  label = (m: string) => MUSCLE_LABEL[m] ?? m;
  pct = (f: number) => Math.round(Math.max(0, Math.min(1, f)) * 100);
  wait = (h: number) => (h >= 24 ? `${Math.round(h / 24)} d` : `${Math.max(1, Math.round(h))} h`);
  when = (d: Date) => {
    const now = this.clock.now();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    // Arredonda para a hora seguinte: é uma estimativa, não um relógio.
    const r = new Date(d.getTime());
    if (r.getMinutes() || r.getSeconds()) r.setHours(r.getHours() + 1, 0, 0, 0);
    const hh = `${r.getHours()}h`;
    d = r;
    if (d.toDateString() === now.toDateString()) return `hoje às ${hh}`;
    if (d.toDateString() === tomorrow.toDateString()) return `amanhã às ${hh}`;
    return d.toLocaleDateString('pt-PT', { weekday: 'long' }) + ` às ${hh}`;
  };
  dayLabel = (d: WeekDay) => {
    const state = { done: 'feito', planned: 'planeado', missed: 'ficou por fazer', skipped: 'saltado', empty: 'sem treino' }[d.kind];
    return `${DAY_NAME[d.weekday]}${d.today ? ' (hoje)' : ''}: ${d.name ? d.name + ', ' : ''}${state}`;
  };
}
