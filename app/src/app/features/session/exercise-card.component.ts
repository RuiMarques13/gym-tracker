import { Component, computed, input, output, signal } from '@angular/core';
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, checkmark, checkmarkCircle, close, ellipseOutline, play, trashOutline } from 'ionicons/icons';
import type { SessionExercise, SetGroup } from '../../data/models/session';
import { groupSets } from '../../data/models/session';
import type { LoadSuggestion } from '../../core/progression/load';
import { RuleWhyComponent } from '../../shared/rule-why.component';
import { formatSetGroup, kgLabel } from './session-format';

export interface CycleWeekInfo {
  block: string;
  week: number;
  weeks: number;
  type: string;
  rir: number | null;
}

/**
 * Cartão de um exercício na sessão: sugestão de hoje, séries feitas, registo de um toque e pergunta da reserva.
 * Não grava nada: emite o que o utilizador escolheu.
 */
@Component({
  selector: 'app-exercise-card',
  imports: [RuleWhyComponent, IonList, IonItem, IonLabel, IonBadge, IonButton, IonIcon, IonSpinner],
  template: `
    @let ex = exercise();
    <section class="card" [class.done]="done()">
      <header>
        <ion-icon [name]="done() ? 'checkmark-circle' : 'ellipse-outline'" class="status" />
        <div class="title">
          <h2>{{ ex.exerciseName }}</h2>
          <p>{{ targetsLabel() }}</p>
          @if (supersetLabel(); as l) { <p class="ss">{{ l }}</p> }
        </div>
        <button type="button" class="icon-btn" (click)="removeExercise.emit()" aria-label="Tirar exercício">
          <ion-icon name="trash-outline" />
        </button>
      </header>

      @if (suggestion(); as sg) {
        <div class="today" [class.up]="sg.action === 'increase'" [class.down]="sg.action === 'decrease'">
          <div class="today-main">
            <span class="lbl">Hoje</span>
            <strong>
              @if (todayKg() !== null) { {{ kg(todayKg()!) }} × }
              @else if (sg.rangeKg) { {{ kg(sg.rangeKg[0]) }}–{{ kg(sg.rangeKg[1]) }} × }
              {{ sg.repsMin }}–{{ sg.repsMax }}
            </strong>
            @if (sg.action === 'increase') { <span class="tag">sobe</span> }
            @if (sg.action === 'decrease') { <span class="tag">desce</span> }
          </div>
          @if (sg.target; as st) {
            <p class="why">{{ goalLabel() }}: {{ st.label }} estimado ({{ kg(st.e1rm) }}) ≈ {{ st.lo === st.hi ? kg(st.lo) : num(st.lo) + '–' + kg(st.hi) }}@if (st.cue) {, {{ st.cue }}}.</p>
          }
          @if (cycleWeek(); as cw) {
            <p class="why">Ciclo · {{ cw.block }}, semana {{ cw.week }}/{{ cw.weeks }} ({{ cw.type }})@if (ex.targetSets) { · {{ setsToday() }} séries }@if (cw.rir !== null) { · RIR {{ cw.rir }} }</p>
          } @else if (deload() && ex.targetSets) { <p class="why">Descarga: {{ setsToday() }} de {{ ex.targetSets }} séries.</p> }
          @if (sg.options.length > 1) {
            <div class="opts" role="group" aria-label="Carga de hoje">
              @for (o of sg.options; track o) {
                <button type="button" [class.on]="todayKg() === o" [attr.aria-pressed]="todayKg() === o" (click)="choose.emit(o)">{{ kg(o) }}</button>
              }
            </div>
          }
          <p class="why">{{ sg.reason }}</p>
          <button type="button" class="whybtn" (click)="whyOpen.set(!whyOpen())" [attr.aria-expanded]="whyOpen()">{{ whyOpen() ? 'Fechar' : 'Porquê?' }}</button>
          @if (whyOpen()) { <app-rule-why class="rulewhy" [key]="sg.rule" /> }
        </div>
      }

      @if (groups().length) {
        <ion-list lines="full" class="sets">
          @for (g of groups(); track g.position) {
            <ion-item button [detail]="false" (click)="openSet.emit(g.position)">
              <ion-label>
                <span class="n">{{ g.position }}</span>
                {{ format(g) }}
                @if (g.type === 'WARMUP') { <ion-badge color="medium">Aquecimento</ion-badge> }
                @else if (rirOf(g) !== null) { <span class="rir">RIR {{ rirOf(g) === 4 ? '4+' : rirOf(g) }}</span> }
              </ion-label>
            </ion-item>
          }
        </ion-list>
      }

      @if (rirAsk() !== null) {
        <div class="ask" role="group" aria-label="Repetições em reserva">
          <div class="ask-head">
            <p>Série {{ rirAsk() }}: quantas repetições ficaram em reserva? <span>(opcional)</span></p>
            <button type="button" class="ask-close" (click)="dismissRir.emit()" aria-label="Não responder"><ion-icon name="close" /></button>
          </div>
          <div class="ask-row">
            @for (n of scale; track n) {
              <button type="button" class="chip" (click)="setRir.emit({ position: rirAsk()!, rir: n })">{{ n === 4 ? '4+' : n }}</button>
            }
          </div>
        </div>
      }

      <div class="actions">
        @if (ex.kind === 'CARDIO' && !historical()) {
          <ion-button class="big" expand="block" (click)="startCardio.emit()">
            <ion-icon slot="start" name="play" /> {{ liveHere() ? 'Voltar à atividade' : 'Iniciar atividade' }}
          </ion-button>
          <ion-button expand="block" fill="clear" (click)="openSet.emit(null)">Registar à mão</ion-button>
        } @else if (quick(); as q) {
          <div class="quick">
            <button type="button" class="quick-edit" (click)="openSet.emit(null)" aria-label="Registar com outros valores">
              <span class="pencil" aria-hidden="true">✏️</span>
            </button>
            <button type="button" class="quick-main" (click)="quickLog.emit()" [disabled]="busy()" [attr.aria-label]="'Registar série: ' + q">
              @if (busy()) { <ion-spinner name="dots" /> } @else { <ion-icon name="checkmark" /> }
              <span>{{ q }}</span>
            </button>
          </div>
        } @else {
          <ion-button class="big" expand="block" fill="outline" (click)="openSet.emit(null)">
            <ion-icon slot="start" name="add" /> Registar série
          </ion-button>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .card { background: var(--ion-card-background, var(--ion-item-background, #fff)); border-radius: 14px; margin-bottom: 12px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); overflow: hidden; }
    .card header { display: flex; align-items: center; gap: 10px; padding: 12px 4px 6px 14px; }
    .status { font-size: 24px; color: var(--ion-color-medium); flex: 0 0 auto; }
    .card.done .status { color: var(--ion-color-success); }
    .title { flex: 1; min-width: 0; }
    .title h2 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .title p { margin: 2px 0 0; font-size: 0.9rem; color: var(--ion-color-medium); }
    .ss { color: var(--ion-color-primary); font-weight: 600; }
    .icon-btn { width: 48px; height: 48px; flex: 0 0 auto; display: grid; place-items: center; border: 0; border-radius: 12px;
      background: none; color: var(--ion-color-medium); font-size: 20px; }
    .today { margin: 4px 12px 8px; padding: 10px 12px; border-radius: 12px; background: var(--ion-color-step-50, rgba(128,128,128,.08)); }
    .today.up { background: rgba(var(--ion-color-primary-rgb), .12); }
    .today.down { background: rgba(var(--ion-color-warning-rgb), .14); }
    .today-main { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .today .lbl { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--ion-color-medium); }
    .today strong { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
    .today .tag { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .today.down .tag { background: var(--ion-color-warning); color: var(--ion-color-warning-contrast); }
    .opts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .opts button { font: inherit; font-size: 0.95rem; font-weight: 600; min-height: 48px; min-width: 64px; padding: 0 14px; border-radius: 999px;
      border: 1px solid var(--ion-color-medium); background: none; color: inherit; }
    .opts button.on { border-color: var(--ion-color-primary); background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .why { margin: 6px 0 0; font-size: 0.85rem; color: var(--ion-color-medium); line-height: 1.4; }
    .whybtn { font: inherit; font-size: 0.9rem; font-weight: 600; border: 0; background: none; color: var(--ion-color-primary);
      min-height: 44px; padding: 0 4px; margin: 0 0 -6px -4px; }
    .rulewhy { display: block; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(128,128,128,.2); }
    .sets ion-item { --min-height: 52px; font-size: 1.05rem; font-variant-numeric: tabular-nums; }
    .n { display: inline-grid; place-items: center; width: 26px; height: 26px; margin-right: 10px; border-radius: 50%;
      background: var(--ion-color-step-150, #ddd); font-size: 0.8rem; font-weight: 700; }
    .rir { margin-left: 8px; font-size: 0.8rem; color: var(--ion-color-medium); }
    .ask { margin: 8px 12px 0; padding: 10px 12px; border-radius: 12px; background: rgba(var(--ion-color-primary-rgb), .08); }
    .ask-head { display: flex; align-items: flex-start; gap: 4px; }
    .ask p { flex: 1; margin: 4px 0 8px; font-size: 0.95rem; }
    .ask-close { width: 48px; height: 48px; flex: 0 0 auto; margin: -8px -8px 0 0; border: 0; background: none;
      color: var(--ion-color-medium); font-size: 22px; display: grid; place-items: center; }
    .ask p span { color: var(--ion-color-medium); font-size: 0.85rem; }
    .ask-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--ion-color-primary); background: transparent;
      color: inherit; font: inherit; font-size: 1rem; font-weight: 700; display: grid; place-items: center; }
    .chip:active { background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .actions { padding: 10px 12px 12px; }
    .big { --padding-top: 14px; --padding-bottom: 14px; min-height: 52px; }
    /* Editar à esquerda: a bolha do temporizador fica, por defeito, no canto inferior direito. */
    .quick { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 8px; }
    .quick-main { min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 12px;
      border: 0; border-radius: 14px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast);
      font: inherit; font-size: 1.15rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .quick-main ion-icon { font-size: 24px; flex: 0 0 auto; }
    .quick-main span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .quick-main:active { filter: brightness(.9); }
    .quick-main[disabled] { opacity: .7; }
    .pencil { font-size: 24px; line-height: 1; }
    .quick-edit { min-height: 56px; border-radius: 14px; border: 1px solid var(--ion-color-primary); background: transparent;
      color: var(--ion-color-primary); font-size: 22px; display: grid; place-items: center; }
  `,
})
export class ExerciseCardComponent {
  readonly exercise = input.required<SessionExercise>();
  readonly historical = input(false);
  readonly targetsLabel = input('');
  readonly supersetLabel = input<string | null>(null);
  readonly done = input(false);
  readonly suggestion = input<LoadSuggestion | null>(null);
  readonly todayKg = input<number | null>(null);
  readonly goalLabel = input('');
  readonly cycleWeek = input<CycleWeekInfo | null>(null);
  readonly deload = input(false);
  /** Séries de hoje (ciclo ou descarga). */
  readonly setsToday = input(0);
  /** Texto do botão de um toque («60 kg × 10»); null = sem registo de um toque. */
  readonly quick = input<string | null>(null);
  readonly busy = input(false);
  /** Posição da série a que falta a reserva (depois do registo de um toque). */
  readonly rirAsk = input<number | null>(null);
  readonly liveHere = input(false);

  readonly openSet = output<number | null>();
  readonly removeExercise = output<void>();
  readonly choose = output<number>();
  readonly quickLog = output<void>();
  readonly startCardio = output<void>();
  readonly setRir = output<{ position: number; rir: number }>();
  readonly dismissRir = output<void>();

  readonly scale = [0, 1, 2, 3, 4];
  readonly whyOpen = signal(false);
  readonly groups = computed(() => groupSets(this.exercise().sets));

  constructor() {
    addIcons({ add, checkmark, checkmarkCircle, close, ellipseOutline, play, trashOutline });
  }

  kg = kgLabel;
  num = (x: number) => x.toLocaleString('pt-PT', { maximumFractionDigits: 2 });
  format = (g: SetGroup) => formatSetGroup(this.exercise(), g);
  /** Reserva de uma série de trabalho de força (a mesma nos dois lados, ou a do primeiro). */
  rirOf = (g: SetGroup): number | null => (this.exercise().kind === 'STRENGTH' ? (g.sets.find((s) => s.rir !== null)?.rir ?? null) : null);
}
