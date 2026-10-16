import { Component, computed, effect, inject, input, linkedSignal, OnDestroy, output, signal, untracked } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonLabel, IonSegment, IonSegmentButton, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, remove, stopwatchOutline, trashOutline } from 'ionicons/icons';
import type { SetType, Side } from '../../data/models/enums';
import type { SessionExercise } from '../../data/models/session';
import { stepValue } from '../../core/session/next-set';
import { TimerService } from '../../services/timer/timer.service';
import { EMPTY_FORM, entriesOf, str, toNum, type SheetSave, type SheetState, type SideForm } from './set-form';

type TextField = Exclude<keyof SideForm, 'rom' | 'rir'>;

/**
 * Folha «Registar série» / «Editar série»: carga e repetições com − / + (passo do material e 1), reserva, amplitude,
 * duração com cronómetro, lados nos unilaterais. Só trata do formulário; quem a abre grava.
 */
@Component({
  selector: 'app-set-sheet',
  // Dentro do ion-modal, o componente faz de página (cabeçalho fixo e conteúdo com scroll).
  host: { class: 'ion-page' },
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon, IonInput, IonLabel, IonSegment, IonSegmentButton],
  template: `
    @let ex = exercise();
    @let sh = state();
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ ex.exerciseName }}</ion-title>
        <ion-buttons slot="end"><ion-button (click)="cancelled.emit()">Cancelar</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="sheet">
        <p class="sheet-sub">
          Série {{ sh.position ?? nextPosition() }}@if (ex.targetSets) { de {{ ex.targetSets }} } · {{ targetsLabel() }}
        </p>

        @if (ex.kind === 'STRENGTH') {
          <ion-segment [value]="sh.type" (ionChange)="setType($any($event).detail.value)">
            <ion-segment-button value="WORKING"><ion-label>Trabalho</ion-label></ion-segment-button>
            <ion-segment-button value="WARMUP"><ion-label>Aquecimento</ion-label></ion-segment-button>
          </ion-segment>
        }

        @for (side of sides(); track side) {
          <div class="side">
            @if (ex.isUnilateral) { <h4>{{ side === 'LEFT' ? 'Esquerdo' : 'Direito' }}</h4> }
            <div class="fields" [class.steppers]="ex.metricType !== 'DURATION'">
              @if (ex.metricType === 'WEIGHT_REPS') {
                <div class="stepper">
                  <button type="button" class="step" (click)="step(side, 'weight', -weightStep(), 0)" [attr.aria-label]="'Menos ' + num(weightStep()) + ' kg'">
                    <ion-icon name="remove" />
                  </button>
                  <ion-input label="Carga (kg)" labelPlacement="stacked" fill="outline" type="number" inputmode="decimal"
                    [value]="field(side, 'weight')" (ionInput)="setField(side, 'weight', $any($event).detail.value)" />
                  <button type="button" class="step" (click)="step(side, 'weight', weightStep(), 0)" [attr.aria-label]="'Mais ' + num(weightStep()) + ' kg'">
                    <ion-icon name="add" />
                  </button>
                </div>
              }
              @if (ex.metricType !== 'DURATION') {
                <div class="stepper">
                  <button type="button" class="step" (click)="step(side, 'reps', -1, 1)" aria-label="Menos uma repetição"><ion-icon name="remove" /></button>
                  <ion-input label="Repetições" labelPlacement="stacked" fill="outline" type="number" inputmode="numeric"
                    [value]="field(side, 'reps')" (ionInput)="setField(side, 'reps', $any($event).detail.value)" />
                  <button type="button" class="step" (click)="step(side, 'reps', 1, 1)" aria-label="Mais uma repetição"><ion-icon name="add" /></button>
                </div>
              } @else {
                <ion-input [label]="ex.kind === 'CARDIO' ? 'Duração (min)' : 'Duração (s)'" labelPlacement="stacked" fill="outline"
                  type="number" inputmode="decimal" [value]="field(side, 'duration')"
                  (ionInput)="setField(side, 'duration', $any($event).detail.value)" />
              }
            </div>
            @if (ex.metricType === 'DURATION') {
              <ion-button fill="outline" (click)="toggleWork(side)">
                <ion-icon slot="start" name="stopwatch-outline" />
                {{ workSide() === side ? 'Parar e usar o tempo' : 'Cronómetro' }}
              </ion-button>
            }
            @if (ex.kind === 'CARDIO') {
              <div class="fields">
                <ion-input label="Distância (km)" labelPlacement="stacked" fill="outline" type="number" inputmode="decimal"
                  [value]="field(side, 'distance')" (ionInput)="setField(side, 'distance', $any($event).detail.value)" />
                <ion-input label="Calorias" labelPlacement="stacked" fill="outline" type="number" inputmode="numeric"
                  [value]="field(side, 'calories')" (ionInput)="setField(side, 'calories', $any($event).detail.value)" />
              </div>
            }
            @if (ex.kind === 'STRENGTH' && sh.type === 'WORKING') {
              <div class="chips" role="group" aria-label="Repetições em reserva">
                <span>Reserva</span>
                @for (n of scale; track n) {
                  <button type="button" class="chip" [class.on]="sh.sides[side]?.rir === n" [attr.aria-pressed]="sh.sides[side]?.rir === n"
                    (click)="toggle(side, 'rir', n)">{{ n === 4 ? '4+' : n }}</button>
                }
              </div>
            }
            @if (ex.kind === 'MOBILITY' && showRom()) {
              <div class="chips" role="group" aria-label="Amplitude">
                <span>Amplitude</span>
                @for (n of romScale; track n) {
                  <button type="button" class="chip" [class.on]="sh.sides[side]?.rom === n" [attr.aria-pressed]="sh.sides[side]?.rom === n"
                    (click)="toggle(side, 'rom', n)">{{ n }}</button>
                }
              </div>
            }
          </div>
        }
        @if (ex.isUnilateral) {
          <ion-button fill="clear" (click)="copySide()">Direito igual ao esquerdo</ion-button>
        }

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <ion-button class="save" expand="block" (click)="save()">{{ sh.position ? 'Guardar' : 'Registar' }}</ion-button>
        @if (sh.position) {
          <ion-button expand="block" fill="clear" color="danger" (click)="removed.emit(sh.position)">
            <ion-icon slot="start" name="trash-outline" /> Apagar série
          </ion-button>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .sheet { padding: 12px 16px 24px; display: grid; gap: 14px; max-width: 520px; margin: 0 auto; }
    .sheet-sub { margin: 0; color: var(--ion-color-medium); font-size: 0.9rem; }
    .side h4 { margin: 0 0 8px; font-size: 0.95rem; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 8px; }
    .fields.steppers { grid-template-columns: 1fr; }
    .stepper { display: grid; grid-template-columns: 56px minmax(0, 1fr) 56px; gap: 6px; align-items: end; }
    .step { width: 56px; height: 56px; border-radius: 12px; border: 1px solid var(--ion-color-medium); background: transparent;
      color: inherit; font-size: 22px; display: grid; place-items: center; }
    .step:active { background: rgba(var(--ion-color-primary-rgb), .15); }
    .chips { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; font-size: 0.9rem; }
    .chips span { flex: 0 0 100%; color: var(--ion-color-medium); }
    .chip { width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--ion-color-medium); background: transparent;
      color: inherit; font: inherit; font-size: 1rem; font-weight: 600; }
    .chip.on { background: var(--ion-color-primary); border-color: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .save { --padding-top: 16px; --padding-bottom: 16px; font-size: 1.05rem; }
    .error { margin: 0; color: var(--ion-color-danger); font-size: 0.9rem; }
  `,
})
export class SetSheetComponent implements OnDestroy {
  private readonly timer = inject(TimerService);

  readonly exercise = input.required<SessionExercise>();
  readonly initial = input.required<SheetState>();
  readonly targetsLabel = input('');
  readonly nextPosition = input(1);
  readonly showRom = input(false);
  /** Passo do − / + da carga (incremento do material). */
  readonly weightStep = input(2.5);
  readonly error = input<string | null>(null);

  readonly saved = output<SheetSave>();
  readonly removed = output<number>();
  readonly cancelled = output<void>();

  readonly scale = [0, 1, 2, 3, 4];
  readonly romScale = [1, 2, 3, 4, 5];
  readonly state = linkedSignal(() => this.initial());
  readonly workSide = signal<Side | null>(null);
  readonly sides = computed<Side[]>(() => (this.exercise().isUnilateral ? ['LEFT', 'RIGHT'] : ['BOTH']));

  num = (x: number) => x.toLocaleString('pt-PT', { maximumFractionDigits: 2 });

  constructor() {
    addIcons({ add, remove, stopwatchOutline, trashOutline });
    // Cronómetro de duração chegou ao fim: usa o tempo na série.
    effect(() => {
      const f = this.timer.finished();
      untracked(() => {
        const side = this.workSide();
        if (f && f.kind === 'WORK' && side) {
          this.fillDuration(side, f.seconds);
          this.timer.stop();
          this.workSide.set(null);
        }
      });
    });
  }

  ngOnDestroy(): void {
    if (this.workSide()) this.timer.stop();
  }

  field(side: Side, key: TextField): string {
    return String(this.state().sides[side]?.[key] ?? '');
  }

  setType(type: SetType): void {
    this.state.update((s) => ({ ...s, type }));
  }

  setField(side: Side, key: TextField, value: string | null | undefined): void {
    this.patch(side, { [key]: value ?? '' });
  }

  step(side: Side, key: 'weight' | 'reps', delta: number, min: number): void {
    const next = stepValue(toNum(this.field(side, key)), delta, min);
    this.patch(side, { [key]: str(next, key === 'reps' ? 0 : 2) });
  }

  toggle(side: Side, key: 'rir' | 'rom', n: number): void {
    const cur = this.state().sides[side]?.[key] ?? null;
    this.patch(side, { [key]: cur === n ? null : n });
  }

  copySide(): void {
    this.state.update((s) => (s.sides.LEFT ? { ...s, sides: { ...s.sides, RIGHT: { ...s.sides.LEFT } } } : s));
  }

  toggleWork(side: Side): void {
    const ex = this.exercise();
    if (this.workSide() === side) {
      const done = this.timer.stop();
      this.workSide.set(null);
      if (done > 0) this.fillDuration(side, done);
      return;
    }
    const current = toNum(this.field(side, 'duration'));
    const seconds = ex.kind === 'CARDIO' ? (current ?? 0) * 60 : (current ?? ex.targetDurationSeconds ?? 30);
    this.workSide.set(side);
    this.timer.start('WORK', ex.exerciseName + (ex.isUnilateral ? (side === 'LEFT' ? ' · esquerdo' : ' · direito') : ''), seconds || ex.targetDurationSeconds || 30);
  }

  save(): void {
    const ex = this.exercise();
    const s = this.state();
    // Um cronómetro a correr para quando a folha fecha (ngOnDestroy), como antes.
    this.saved.emit({ position: s.position, type: ex.kind === 'STRENGTH' ? s.type : 'WORKING', entries: entriesOf(ex.kind, ex.metricType, s, this.sides()) });
  }

  private fillDuration(side: Side, seconds: number): void {
    this.setField(side, 'duration', this.exercise().kind === 'CARDIO' ? str(seconds / 60) : String(seconds));
  }

  private patch(side: Side, change: Partial<SideForm>): void {
    this.state.update((s) => ({ ...s, sides: { ...s.sides, [side]: { ...(s.sides[side] ?? EMPTY_FORM), ...change } } }));
  }
}
