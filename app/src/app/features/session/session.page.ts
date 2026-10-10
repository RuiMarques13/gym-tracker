import { Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
  NavController,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, checkmarkCircle, ellipseOutline, stopwatchOutline, trashOutline } from 'ionicons/icons';
import { SettingsService } from '../../core/settings/settings.service';
import { formatClock } from '../../core/timer/timer-math';
import { TimerService } from '../../core/timer/timer.service';
import { CLOCK } from '../../core/util/clock';
import type { SetType, Side } from '../../data/models/enums';
import type { Exercise } from '../../data/models/exercise';
import { groupSets, Session, SessionError, SessionExercise, SessionSet, SideEntry, workingSetCount } from '../../data/models/session';
import { BLOCK_LABEL, BLOCK_ORDER } from '../../data/models/workout';
import { SESSION_REPOSITORY } from '../../data/repositories/providers';
import { ExercisePickerComponent } from '../workouts/exercise-picker.component';
import { formatTargets } from '../workouts/workout-format';
import { formatSetGroup } from './session-format';

interface SideForm {
  weight: string;
  reps: string;
  /** Segundos (minutos no cardio). */
  duration: string;
  /** km */
  distance: string;
  calories: string;
  rom: number | null;
}
interface SheetState {
  exerciseId: string;
  position: number | null;
  type: SetType;
  sides: Partial<Record<Side, SideForm>>;
}

const EMPTY: SideForm = { weight: '', reps: '', duration: '', distance: '', calories: '', rom: null };
const toNum = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const str = (n: number | null | undefined, digits = 2): string => (n === null || n === undefined ? '' : String(Math.round(n * 10 ** digits) / 10 ** digits));

/** Sessão em curso: registar séries, descanso e duração com o temporizador, terminar. */
@Component({
  selector: 'app-session',
  imports: [
    RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonFooter, IonList, IonItem,
    IonLabel, IonBadge, IonInput, IonTextarea, IonModal, IonSegment, IonSegmentButton, IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-button routerLink="/home">Sair</ion-button></ion-buttons>
        <ion-title>{{ session()?.templateName ?? 'Sessão livre' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button class="finish" (click)="finishOpen.set(true)"><strong>Terminar</strong></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (!session()) {
        <div class="center"><ion-spinner /></div>
      } @else {
        <div class="page">
          <div class="summary">
            <span class="clock"><ion-icon name="stopwatch-outline" /> {{ elapsed() }}</span>
            <span>{{ totalSets() }} {{ totalSets() === 1 ? 'série' : 'séries' }}</span>
            <span>{{ session()!.exercises.length }} {{ session()!.exercises.length === 1 ? 'exercício' : 'exercícios' }}</span>
          </div>

          @for (b of blocks(); track b.block) {
            <h3 class="block-title">{{ blockLabel[b.block] }}</h3>
            @for (ex of b.items; track ex.id) {
              <section class="card" [class.done]="isDone(ex)">
                <header>
                  <ion-icon [name]="isDone(ex) ? 'checkmark-circle' : 'ellipse-outline'" class="status" />
                  <div class="title">
                    <h2>{{ ex.exerciseName }}</h2>
                    <p>{{ targets(ex) }}</p>
                  </div>
                  <ion-button fill="clear" size="small" color="medium" (click)="removeExercise(ex)" aria-label="Tirar exercício">
                    <ion-icon slot="icon-only" name="trash-outline" />
                  </ion-button>
                </header>
                @if (groups(ex).length) {
                  <ion-list lines="full" class="sets">
                    @for (g of groups(ex); track g.position) {
                      <ion-item button [detail]="false" (click)="openSheet(ex, g.position)">
                        <ion-label>
                          <span class="n">{{ g.position }}</span>
                          {{ format(ex, g) }}
                          @if (g.type === 'WARMUP') { <ion-badge color="medium">Aquecimento</ion-badge> }
                        </ion-label>
                      </ion-item>
                    }
                  </ion-list>
                }
                <div class="actions">
                  <ion-button expand="block" fill="outline" (click)="openSheet(ex, null)">
                    <ion-icon slot="start" name="add" /> Registar série
                  </ion-button>
                </div>
              </section>
            }
          }
          @if (!session()!.exercises.length) {
            <p class="hint">Sessão livre: adiciona os exercícios que fores fazendo.</p>
          }
        </div>
      }
    </ion-content>

    <ion-footer>
      <div class="footer">
        <ion-button expand="block" fill="solid" color="light" (click)="addExercises()" [disabled]="!session()">
          <ion-icon slot="start" name="add" /> Adicionar exercício
        </ion-button>
      </div>
    </ion-footer>

    <!-- Registar / editar uma série -->
    <ion-modal [isOpen]="!!sheet()" (didDismiss)="closeSheet()" [initialBreakpoint]="0.85" [breakpoints]="[0, 0.85, 1]">
      <ng-template>
        @if (sheet(); as sh) {
          @if (sheetExercise(); as ex) {
            <ion-header>
              <ion-toolbar>
                <ion-title>{{ ex.exerciseName }}</ion-title>
                <ion-buttons slot="end"><ion-button (click)="closeSheet()">Cancelar</ion-button></ion-buttons>
              </ion-toolbar>
            </ion-header>
            <ion-content>
              <div class="sheet">
                <p class="sheet-sub">
                  {{ sh.position ? 'Série ' + sh.position : 'Série ' + nextPosition(ex) }}
                  @if (ex.targetSets) { de {{ ex.targetSets }} }
                  · {{ targets(ex) }}
                </p>

                @if (ex.kind === 'STRENGTH') {
                  <ion-segment [value]="sh.type" (ionChange)="setType($any($event).detail.value)">
                    <ion-segment-button value="WORKING"><ion-label>Trabalho</ion-label></ion-segment-button>
                    <ion-segment-button value="WARMUP"><ion-label>Aquecimento</ion-label></ion-segment-button>
                  </ion-segment>
                }

                @for (side of sheetSides(); track side) {
                  <div class="side">
                    @if (ex.isUnilateral) { <h4>{{ side === 'LEFT' ? 'Esquerdo' : 'Direito' }}</h4> }
                    <div class="fields">
                      @if (ex.metricType === 'WEIGHT_REPS') {
                        <ion-input label="Carga (kg)" labelPlacement="stacked" fill="outline" type="number" inputmode="decimal"
                          [value]="field(side, 'weight')" (ionInput)="setField(side, 'weight', $any($event).detail.value)" />
                      }
                      @if (ex.metricType !== 'DURATION') {
                        <ion-input label="Repetições" labelPlacement="stacked" fill="outline" type="number" inputmode="numeric"
                          [value]="field(side, 'reps')" (ionInput)="setField(side, 'reps', $any($event).detail.value)" />
                      } @else {
                        <ion-input [label]="ex.kind === 'CARDIO' ? 'Duração (min)' : 'Duração (s)'" labelPlacement="stacked" fill="outline"
                          type="number" inputmode="decimal" [value]="field(side, 'duration')"
                          (ionInput)="setField(side, 'duration', $any($event).detail.value)" />
                      }
                    </div>
                    @if (ex.metricType === 'DURATION') {
                      <ion-button size="small" fill="outline" (click)="toggleWork(ex, side)">
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
                    @if (ex.kind === 'MOBILITY' && showRom()) {
                      <div class="rom">
                        <span>Amplitude</span>
                        @for (n of [1, 2, 3, 4, 5]; track n) {
                          <button type="button" class="chip" [class.on]="sheetRom(side) === n" (click)="toggleRom(side, n)">{{ n }}</button>
                        }
                      </div>
                    }
                  </div>
                }
                @if (ex.isUnilateral) {
                  <ion-button size="small" fill="clear" (click)="copySide()">Direito igual ao esquerdo</ion-button>
                }

                @if (sheetError()) { <p class="error">{{ sheetError() }}</p> }
                <ion-button expand="block" (click)="saveSheet()">{{ sh.position ? 'Guardar' : 'Registar' }}</ion-button>
                @if (sh.position) {
                  <ion-button expand="block" fill="clear" color="danger" (click)="deleteSet()">
                    <ion-icon slot="start" name="trash-outline" /> Apagar série
                  </ion-button>
                }
              </div>
            </ion-content>
          }
        }
      </ng-template>
    </ion-modal>

    <!-- Terminar -->
    <ion-modal [isOpen]="finishOpen()" (didDismiss)="finishOpen.set(false)" [initialBreakpoint]="0.7" [breakpoints]="[0, 0.7, 1]">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Terminar sessão</ion-title>
            <ion-buttons slot="end"><ion-button (click)="finishOpen.set(false)">Voltar</ion-button></ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div class="sheet">
            <p class="sheet-sub">{{ elapsed() }} · {{ totalSets() }} séries</p>
            <ion-input label="Esforço da sessão (0–10)" labelPlacement="stacked" fill="outline" type="number" inputmode="decimal"
              placeholder="Opcional" [value]="finishRpe()" (ionInput)="finishRpe.set($any($event).detail.value ?? '')" />
            <ion-textarea label="Notas" labelPlacement="stacked" fill="outline" [autoGrow]="true" placeholder="Opcional"
              [value]="finishNotes()" (ionInput)="finishNotes.set($any($event).detail.value ?? '')" />
            @if (!totalSets()) { <p class="hint">Ainda não registaste nenhuma série.</p> }
            <ion-button expand="block" (click)="finish()">Terminar e guardar</ion-button>
            <ion-button expand="block" fill="clear" color="danger" (click)="discard()">Descartar sessão</ion-button>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; padding: 8px 12px 24px; }
    .center { display: grid; place-items: center; height: 60vh; }
    .summary { display: flex; gap: 14px; align-items: center; color: var(--ion-color-medium); font-size: 0.9rem; padding: 6px 4px 0; }
    .clock { font-weight: 700; color: var(--ion-text-color); font-size: 1.15rem; font-variant-numeric: tabular-nums; }
    .block-title { margin: 18px 4px 6px; font-size: 0.8rem; font-weight: 700; color: var(--ion-color-medium); }
    .card { background: var(--ion-card-background, var(--ion-item-background, #fff)); border-radius: 14px; margin-bottom: 12px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); overflow: hidden; }
    .card header { display: flex; align-items: center; gap: 10px; padding: 12px 6px 6px 14px; }
    .status { font-size: 24px; color: var(--ion-color-medium); }
    .card.done .status { color: var(--ion-color-success); }
    .title { flex: 1; min-width: 0; }
    .title h2 { margin: 0; font-size: 1.05rem; font-weight: 700; }
    .title p { margin: 2px 0 0; font-size: 0.85rem; color: var(--ion-color-medium); }
    .sets ion-item { --min-height: 44px; font-variant-numeric: tabular-nums; }
    .n { display: inline-grid; place-items: center; width: 22px; height: 22px; margin-right: 8px; border-radius: 50%;
      background: var(--ion-color-step-150, #ddd); font-size: 0.75rem; font-weight: 700; }
    .actions { padding: 8px 12px 12px; }
    .hint { text-align: center; color: var(--ion-color-medium); margin: 24px 0; }
    .footer { max-width: 760px; margin: 0 auto; padding: 4px 12px; }
    .sheet { padding: 12px 16px 24px; display: grid; gap: 14px; max-width: 520px; margin: 0 auto; }
    .sheet-sub { margin: 0; color: var(--ion-color-medium); font-size: 0.9rem; }
    .side h4 { margin: 0 0 8px; font-size: 0.95rem; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 8px; }
    .rom { display: flex; gap: 8px; align-items: center; margin-top: 8px; font-size: 0.9rem; }
    .rom span { margin-right: 4px; color: var(--ion-color-medium); }
    .chip { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--ion-color-medium); background: transparent;
      color: inherit; font: inherit; font-weight: 600; }
    .chip.on { background: var(--ion-color-primary); border-color: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .error { margin: 0; color: var(--ion-color-danger); font-size: 0.9rem; }
  `,
})
export class SessionPage implements ViewWillEnter, OnDestroy {
  private readonly repo = inject(SESSION_REPOSITORY);
  private readonly settings = inject(SettingsService);
  readonly timer = inject(TimerService);
  private readonly clock = inject(CLOCK);
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly nav = inject(NavController);

  readonly blockLabel = BLOCK_LABEL;
  readonly session = signal<Session | null>(null);
  readonly sheet = signal<SheetState | null>(null);
  readonly sheetError = signal<string | null>(null);
  readonly workSide = signal<Side | null>(null);
  readonly finishOpen = signal(false);
  readonly finishRpe = signal('');
  readonly finishNotes = signal('');
  readonly showRom = this.settings.get('showRomScore');

  private readonly now = signal(this.clock.now().getTime());
  private readonly ticker = setInterval(() => this.now.set(this.clock.now().getTime()), 1000);

  readonly elapsed = computed(() => {
    const s = this.session();
    if (!s) return '0:00';
    return formatClock((this.now() - Date.parse(s.startedAt)) / 1000 - s.pausedSeconds);
  });
  readonly blocks = computed(() => {
    const s = this.session();
    if (!s) return [];
    return BLOCK_ORDER.map((block) => ({ block, items: s.exercises.filter((e) => e.block === block) })).filter((b) => b.items.length);
  });
  readonly totalSets = computed(() => (this.session()?.exercises ?? []).reduce((n, e) => n + groupSets(e.sets).length, 0));
  readonly sheetExercise = computed(() => {
    const sh = this.sheet();
    return sh ? (this.session()?.exercises.find((e) => e.id === sh.exerciseId) ?? null) : null;
  });
  readonly sheetSides = computed<Side[]>(() => (this.sheetExercise()?.isUnilateral ? ['LEFT', 'RIGHT'] : ['BOTH']));

  constructor() {
    addIcons({ add, checkmarkCircle, ellipseOutline, stopwatchOutline, trashOutline });
    // Cronómetro de duração chegou ao fim: usa o tempo na série que está a ser registada.
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
    clearInterval(this.ticker);
  }

  async ionViewWillEnter(): Promise<void> {
    const active = await this.repo.getActive();
    if (!active) {
      this.nav.navigateRoot('/treinos');
      return;
    }
    this.session.set(active);
  }

  groups = (ex: SessionExercise) => groupSets(ex.sets);
  format = (ex: SessionExercise, g: ReturnType<typeof groupSets>[number]) => formatSetGroup(ex, g);
  targets = (ex: SessionExercise) =>
    formatTargets(ex.kind, ex.metricType, ex.isUnilateral, {
      targetSets: ex.targetSets, targetReps: ex.targetReps, targetDurationSeconds: ex.targetDurationSeconds,
      targetWeightKg: ex.targetWeightKg, targetDistanceM: ex.targetDistanceM, restSeconds: ex.restSeconds,
    }) || 'Sem alvo';
  isDone = (ex: SessionExercise) => !!ex.targetSets && workingSetCount(ex) >= ex.targetSets;
  nextPosition = (ex: SessionExercise) => Math.max(0, ...ex.sets.map((s) => s.position)) + 1;

  // --- exercícios ---------------------------------------------------------------------------------

  async addExercises(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const modal = await this.modals.create({
      component: ExercisePickerComponent,
      componentProps: { title: 'Adicionar à sessão', initialKind: 'ALL' },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<Exercise[]>();
    if (role !== 'confirm' || !data?.length) return;
    for (const e of data) await this.repo.addExercise(s.id, e.id, 'MAIN');
    this.session.set((await this.repo.get(s.id)) ?? s);
  }

  async removeExercise(ex: SessionExercise): Promise<void> {
    const n = groupSets(ex.sets).length;
    const alert = await this.alerts.create({
      header: `Tirar «${ex.exerciseName}»?`,
      message: n ? `Perdes as ${n} séries registadas neste exercício.` : undefined,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Tirar', role: 'destructive', handler: () => void this.doRemove(ex) },
      ],
    });
    await alert.present();
  }

  private async doRemove(ex: SessionExercise): Promise<void> {
    await this.repo.removeExercise(ex.id);
    this.patchSession((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== ex.id) }));
  }

  // --- séries -------------------------------------------------------------------------------------

  async openSheet(ex: SessionExercise, position: number | null): Promise<void> {
    this.sheetError.set(null);
    this.workSide.set(null);
    const groups = groupSets(ex.sets);
    let sides: SheetState['sides'] = {};
    let type: SetType = 'WORKING';
    const sidesList: Side[] = ex.isUnilateral ? ['LEFT', 'RIGHT'] : ['BOTH'];
    if (position !== null) {
      const g = groups.find((x) => x.position === position);
      if (!g) return;
      type = g.type;
      for (const s of g.sets) sides[s.side] = this.toForm(ex, s);
      for (const side of sidesList) sides[side] ??= { ...EMPTY };
    } else {
      const last = groups.at(-1);
      let source: SessionSet[] | null = last ? last.sets : null;
      if (!source) {
        const prev = groupSets(await this.repo.previousSets(ex.exerciseId, this.session()!.id));
        source = prev.find((g) => g.type === 'WORKING')?.sets ?? prev[0]?.sets ?? null;
      }
      for (const side of sidesList) {
        const row = source?.find((s) => s.side === side) ?? source?.[0];
        sides[side] = row ? this.toForm(ex, row) : this.fromTargets(ex);
        if (position === null && sides[side]) sides[side] = { ...sides[side]!, rom: null };
      }
      if (last && last.type === 'WARMUP' && ex.kind === 'STRENGTH') type = 'WORKING';
    }
    this.sheet.set({ exerciseId: ex.id, position, type, sides });
  }

  closeSheet(): void {
    if (this.workSide()) {
      this.timer.stop();
      this.workSide.set(null);
    }
    this.sheet.set(null);
  }

  setType(type: SetType): void {
    this.sheet.update((s) => (s ? { ...s, type } : s));
  }
  field(side: Side, key: keyof SideForm): string {
    return String(this.sheet()?.sides[side]?.[key] ?? '');
  }
  sheetRom(side: Side): number | null {
    return this.sheet()?.sides[side]?.rom ?? null;
  }
  setField(side: Side, key: Exclude<keyof SideForm, 'rom'>, value: string | null | undefined): void {
    this.sheet.update((s) => (s ? { ...s, sides: { ...s.sides, [side]: { ...(s.sides[side] ?? EMPTY), [key]: value ?? '' } } } : s));
  }
  toggleRom(side: Side, n: number): void {
    this.sheet.update((s) =>
      s ? { ...s, sides: { ...s.sides, [side]: { ...(s.sides[side] ?? EMPTY), rom: s.sides[side]?.rom === n ? null : n } } } : s,
    );
  }
  copySide(): void {
    this.sheet.update((s) => (s?.sides.LEFT ? { ...s, sides: { ...s.sides, RIGHT: { ...s.sides.LEFT } } } : s));
  }

  toggleWork(ex: SessionExercise, side: Side): void {
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

  private fillDuration(side: Side, seconds: number): void {
    const ex = this.sheetExercise();
    this.setField(side, 'duration', ex?.kind === 'CARDIO' ? str(seconds / 60) : String(seconds));
  }

  async saveSheet(): Promise<void> {
    const sh = this.sheet();
    const ex = this.sheetExercise();
    const s = this.session();
    if (!sh || !ex || !s) return;
    const isNew = sh.position === null;
    const entries: SideEntry[] = [];
    for (const side of this.sheetSides()) {
      const f = sh.sides[side] ?? EMPTY;
      const filled = ex.metricType === 'DURATION' ? toNum(f.duration) : toNum(f.reps);
      if (!filled && this.sheetSides().length > 1) continue; // unilateral: pode registar-se só um lado
      const duration = toNum(f.duration);
      entries.push({
        side,
        weightKg: toNum(f.weight),
        reps: toNum(f.reps),
        durationSeconds: duration === null ? null : ex.kind === 'CARDIO' ? Math.round(duration * 60) : duration,
        distanceM: toNum(f.distance) === null ? null : Math.round(toNum(f.distance)! * 1000),
        caloriesKcal: toNum(f.calories),
        romScore: f.rom,
      });
    }
    try {
      const updated = await this.repo.saveSet({
        sessionExerciseId: ex.id,
        position: sh.position ?? undefined,
        type: ex.kind === 'STRENGTH' ? sh.type : 'WORKING',
        entries,
      });
      this.patchSession((x) => ({ ...x, exercises: x.exercises.map((e) => (e.id === updated.id ? updated : e)) }));
      this.closeSheet();
      if (isNew) this.startRest(updated);
    } catch (err) {
      this.sheetError.set(err instanceof SessionError ? err.message : 'Não foi possível guardar a série.');
    }
  }

  async deleteSet(): Promise<void> {
    const sh = this.sheet();
    const ex = this.sheetExercise();
    if (!sh || !ex || sh.position === null) return;
    const updated = await this.repo.deleteSet(ex.id, sh.position);
    this.patchSession((x) => ({ ...x, exercises: x.exercises.map((e) => (e.id === updated.id ? updated : e)) }));
    this.closeSheet();
  }

  /** Descanso: do treino, do exercício ou o global (só força; mobilidade e cardio não têm por defeito). */
  private startRest(ex: SessionExercise): void {
    const seconds = ex.restSeconds ?? (ex.kind === 'STRENGTH' ? this.settings.get('defaultRestSeconds')() : 0);
    if (seconds > 0) this.timer.start('REST', ex.exerciseName, seconds);
  }

  // --- terminar -----------------------------------------------------------------------------------

  async finish(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const rpe = toNum(this.finishRpe());
    await this.repo.finish(s.id, { rpe, notes: this.finishNotes() });
    this.timer.stop();
    this.finishOpen.set(false);
    await this.toast('Sessão guardada.');
    this.nav.navigateRoot('/home');
  }

  async discard(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const alert = await this.alerts.create({
      header: 'Descartar a sessão?',
      message: 'Perdes tudo o que registaste nesta sessão.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Descartar',
          role: 'destructive',
          handler: () => {
            void (async () => {
              await this.repo.discard(s.id);
              this.timer.stop();
              this.finishOpen.set(false);
              this.nav.navigateRoot('/home');
            })();
          },
        },
      ],
    });
    await alert.present();
  }

  // --- internos -----------------------------------------------------------------------------------

  private patchSession(fn: (s: Session) => Session): void {
    this.session.update((s) => (s ? fn(s) : s));
  }

  private toForm(ex: SessionExercise, s: SessionSet): SideForm {
    return {
      weight: str(s.weightKg), reps: str(s.reps, 0),
      duration: ex.kind === 'CARDIO' ? str(s.durationSeconds === null ? null : s.durationSeconds / 60) : str(s.durationSeconds, 0),
      distance: str(s.distanceM === null ? null : s.distanceM / 1000), calories: str(s.caloriesKcal, 0), rom: s.romScore,
    };
  }

  private fromTargets(ex: SessionExercise): SideForm {
    return {
      weight: str(ex.targetWeightKg), reps: str(ex.targetReps, 0),
      duration: ex.kind === 'CARDIO' ? str(ex.targetDurationSeconds === null ? null : ex.targetDurationSeconds / 60) : str(ex.targetDurationSeconds, 0),
      distance: str(ex.targetDistanceM === null ? null : ex.targetDistanceM / 1000), calories: '', rom: null,
    };
  }

  private async toast(message: string): Promise<void> {
    const t = await this.toasts.create({ message, color: 'success', duration: 1800, position: 'bottom' });
    await t.present();
  }
}
