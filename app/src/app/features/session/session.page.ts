import { EffortScaleComponent } from '../../shared/effort-scale.component';
import { StatTile, StatTilesComponent } from '../../shared/stat-tiles.component';
import { RuleWhyComponent } from '../../shared/rule-why.component';
import { SuggestionCardsComponent } from '../../shared/suggestion-cards.component';
import { ProgressionService, type SuggestionCard } from '../../core/progression/progression.service';
import { MuscleMapComponent } from '../../shared/muscle-map.component';
import { firstExercise } from './session-launcher';
import { BodyProfileService } from '../../core/health/body-profile.service';
import { HealthService } from '../../core/health/health.service';
import { paceOf, sessionStats } from '../../core/metrics/session-stats';
import { Component, computed, effect, inject, input, OnDestroy, resource, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonBackButton,
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
  ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, arrowDown, arrowUp, checkmarkCircle, ellipseOutline, play, remove, stopwatchOutline, trashOutline } from 'ionicons/icons';
import { CardioRunService } from '../../core/timer/cardio-run.service';
import { SettingsService } from '../../core/settings/settings.service';
import { formatClock } from '../../core/timer/timer-math';
import { EffortReminder } from '../../core/timer/effort-reminder';
import { TimerService } from '../../core/timer/timer.service';
import { CLOCK } from '../../core/util/clock';
import type { SetType, Side } from '../../data/models/enums';
import type { Exercise } from '../../data/models/exercise';
import { groupSets, Session, SessionError, SessionExercise, SessionSet, SideEntry, workingSetCount } from '../../data/models/session';
import { BLOCK_LABEL, BLOCK_ORDER } from '../../data/models/workout';
import { MUSCLE_LABEL, specOfMuscleIds } from '../../core/metrics/muscles';
import { portionsForExercise } from '../../core/anatomy/exercise-portions';
import type { PortionId } from '../../core/anatomy/portions';
import type { PortionInfo, PortionProfile } from '../../core/anatomy/profiles';
import { MetricExercise, MetricSet, sessionWarnings } from '../../core/metrics/volume';
import { EXERCISE_REPOSITORY, SESSION_REPOSITORY } from '../../data/repositories/providers';
import { ExercisePickerComponent } from '../workouts/exercise-picker.component';
import { formatDay } from '../history/history-format';
import { formatTargets } from '../workouts/workout-format';
import { repRange, suggestLoad, type LoadSuggestion } from '../../core/progression/load';
import { defaultRest } from '../../core/progression/rest';
import { defaultRepRange, strengthTarget } from '../../core/progression/goals';
import { CycleService, type ActiveCycle } from '../../core/progression/cycle.service';
import { WEEK_LABEL, weekSets } from '../../core/progression/cycles';
import { reliable1RM } from '../../core/metrics/one-rm';
import { nextTimeText } from '../../core/progression/next-time';
import { SEED } from '../../core/seed/seed.generated';
import { ids } from '../../core/util/uuid';

/** id do equipamento → chave do catálogo (barbell, dumbbell…), para ler o incremento nas definições. */
const EQUIPMENT_KEY = new Map(SEED.equipment.map((e) => [ids.equipment(e.key), e.key]));
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
  rir: number | null;
}
interface SheetState {
  exerciseId: string;
  position: number | null;
  type: SetType;
  sides: Partial<Record<Side, SideForm>>;
}

const EMPTY: SideForm = { weight: '', reps: '', duration: '', distance: '', calories: '', rom: null, rir: null };
const toNum = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const str = (n: number | null | undefined, digits = 2): string => (n === null || n === undefined ? '' : String(Math.round(n * 10 ** digits) / 10 ** digits));

/** Sessão em curso: registar séries, descanso e duração com o temporizador, terminar. */
import { ToastService } from '../../core/ui/toast.service';

/** Porções do boneco de um exercício guardado. */
const figOf = (ex: Exercise | null | undefined) => {
  if (!ex) return { figPrimary: [] as string[], figSupport: [] as string[], figInfo: {} as PortionProfile['info'] };
  const p = portionsForExercise(ex);
  return { figPrimary: p.primary as string[], figSupport: p.secondary as string[], figInfo: p.info };
};

@Component({
  selector: 'app-session',
  imports: [EffortScaleComponent, StatTilesComponent, MuscleMapComponent, RuleWhyComponent, SuggestionCardsComponent, 
    RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon, IonContent, IonFooter, IonList, IonItem,
    IonLabel, IonBadge, IonInput, IonTextarea, IonModal, IonSegment, IonSegmentButton, IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          @if (historical()) {
            <ion-back-button defaultHref="/historico" text="" />
          } @else {
            <ion-button routerLink="/home">Sair</ion-button>
          }
        </ion-buttons>
        <ion-title>{{ session()?.templateName ?? 'Sessão livre' }}</ion-title>
        <ion-buttons slot="end">
          @if (historical()) {
            <ion-button class="finish" (click)="openDetails()"><strong>Detalhes</strong></ion-button>
          } @else {
            <ion-button class="finish" (click)="openDetails()"><strong>Terminar</strong></ion-button>
          }
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (!session()) {
        <div class="center"><ion-spinner /></div>
      } @else {
        <div class="page">
          @if (historical()) {
            <p class="day">{{ dayLabel() }}</p>
          }
          @if (startIn() !== null) { <p class="start-pill" aria-live="polite">A começar em {{ startIn() }}…</p> }
          <app-stat-tiles size="compact" [cols]="4" [tiles]="mainTiles()" />
          @if (extraTiles().length) {
            <div class="gap"><app-stat-tiles size="compact" [cols]="extraTiles().length > 3 ? 4 : extraTiles().length" [tiles]="extraTiles()" /></div>
          }
          @if (hasStrength()) {
            <section class="muscles" aria-label="Músculos trabalhados">
              <h3>Músculos trabalhados</h3>
              <app-muscle-map [primary]="trained().primary" [secondary]="trained().support" [info]="trained().info" [bySide]="trained().bySide" primaryLabel="Principais" secondaryLabel="Apoio" [compact]="true" />
              @if (!trained().primary.length) { <p class="muted">Aparecem aqui à medida que registas séries.</p> }
            </section>
          }
          @if (liveRun(); as r) {
            <button type="button" class="live" (click)="openLive(r.exerciseId)">
              <span class="dot"></span> Atividade a decorrer: <strong>{{ r.name }}</strong> · voltar
            </button>
          }
          @for (w of warnings(); track w) {
            <p class="warn">{{ w }}</p>
          }
          @if (!historical() && deload(); as d) {
            <div class="deload">
              <div><strong>Semana de descarga</strong> até {{ d.label }}: metade das séries de cada exercício, com a mesma carga.</div>
              <ion-button size="small" fill="clear" (click)="endDeload()">Terminar</ion-button>
            </div>
          }

          @for (b of blocks(); track b.block) {
            <h3 class="block-title">{{ blockLabel[b.block] }}</h3>
            @for (ex of b.items; track ex.id) {
              <section class="card" [class.done]="isDone(ex)">
                <header>
                  <ion-icon [name]="isDone(ex) ? 'checkmark-circle' : 'ellipse-outline'" class="status" />
                  <div class="title">
                    <h2>{{ ex.exerciseName }}</h2>
                    <p>{{ targets(ex) }}</p>
                    @if (ssLabel(ex); as l) { <p class="ss">{{ l }}</p> }
                  </div>
                  <ion-button fill="clear" size="small" color="medium" (click)="removeExercise(ex)" aria-label="Tirar exercício">
                    <ion-icon slot="icon-only" name="trash-outline" />
                  </ion-button>
                </header>
                @if (suggestionOf(ex); as sg) {
                  <div class="today" [class.up]="sg.action === 'increase'" [class.down]="sg.action === 'decrease'">
                    <div class="today-main">
                      <span class="lbl">Hoje</span>
                      <strong>
                        @if (todayKg(ex) !== null) { {{ kgLabel(todayKg(ex)!) }} × }
                        @else if (sg.rangeKg) { {{ kgLabel(sg.rangeKg[0]) }}–{{ kgLabel(sg.rangeKg[1]) }} × }
                        {{ sg.repsMin }}–{{ sg.repsMax }}
                      </strong>
                      @if (sg.action === 'increase') { <span class="tag">sobe</span> }
                      @if (sg.action === 'decrease') { <span class="tag">desce</span> }
                    </div>
                    @if (sg.strength; as st) { <p class="why">Força: ~80% do teu 1RM estimado ({{ kgLabel(st.e1rm) }}) ≈ {{ kgLabel(st.kg) }}.</p> }
                    @if (cycleWeek(); as cw) {
                      <p class="why">Ciclo · {{ cw.block }}, semana {{ cw.week }}/{{ cw.weeks }} ({{ cw.type }})@if (ex.targetSets) { · {{ setsFor(ex) }} séries }@if (cw.rir !== null) { · RIR {{ cw.rir }} }</p>
                    } @else if (deload() && ex.targetSets) { <p class="why">Descarga: {{ setsFor(ex) }} de {{ ex.targetSets }} séries.</p> }
                    @if (sg.options.length > 1) {
                      <div class="opts">
                        @for (o of sg.options; track o) {
                          <button type="button" [class.on]="todayKg(ex) === o" (click)="choose(ex, o)">{{ kgLabel(o) }}</button>
                        }
                      </div>
                    }
                    <p class="why">{{ sg.reason }}
                      <button type="button" class="whybtn" (click)="toggleWhy(ex.id)">{{ whyOpen().has(ex.id) ? 'Fechar' : 'Porquê?' }}</button>
                    </p>
                    @if (whyOpen().has(ex.id)) { <app-rule-why class="rulewhy" [key]="sg.rule" /> }
                  </div>
                }
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
                  @if (ex.kind === 'CARDIO' && !historical()) {
                    <ion-button expand="block" (click)="startCardio(ex)">
                      <ion-icon slot="start" name="play" /> {{ liveRun()?.exerciseId === ex.id ? 'Voltar à atividade' : 'Iniciar atividade' }}
                    </ion-button>
                    <ion-button expand="block" fill="clear" size="small" (click)="openSheet(ex, null)">Registar à mão</ion-button>
                  } @else {
                    <ion-button expand="block" fill="outline" (click)="openSheet(ex, null)">
                      <ion-icon slot="start" name="add" /> Registar série
                    </ion-button>
                  }
                </div>
              </section>
            }
          }
          @if (!session()!.exercises.length) {
            <p class="hint">Sessão livre: escolhe o primeiro exercício e o relógio começa a contar. Depois vais juntando os outros.</p>
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
                    @if (ex.kind === 'STRENGTH' && sh.type === 'WORKING') {
                      <div class="rom">
                        <span>RIR</span>
                        @for (n of [0, 1, 2, 3, 4]; track n) {
                          <button type="button" class="chip" [class.on]="sheetRir(side) === n" (click)="toggleRir(side, n)">{{ n === 4 ? '4+' : n }}</button>
                        }
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
            <ion-title>{{ historical() ? 'Detalhes da sessão' : 'Terminar sessão' }}</ion-title>
            <ion-buttons slot="end"><ion-button (click)="finishOpen.set(false)">Voltar</ion-button></ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div class="sheet">
            <app-stat-tiles [tiles]="allTiles()" />
            <app-effort-scale [text]="finishRpe()" (changed)="finishRpe.set($event)" />
            <ion-textarea label="Notas (opcional)" labelPlacement="stacked" fill="outline" [autoGrow]="true" placeholder="Como te sentiste, dor, sono, stress…"
              [value]="finishNotes()" (ionInput)="finishNotes.set($any($event).detail.value ?? '')" />
            @if (!totalSets() && !historical()) { <p class="hint">Ainda não registaste nenhuma série.</p> }
            @if (!historical() && nextTime().length) {
              <div class="next">
                <h3>Próxima vez</h3>
                @for (n of nextTime(); track n.id) {
                  <div class="next-row" [class.up]="n.action === 'increase'" [class.down]="n.action === 'decrease'">
                    <ion-icon [name]="n.action === 'increase' ? 'arrow-up' : n.action === 'decrease' ? 'arrow-down' : 'remove'" />
                    <div><strong>{{ n.name }}</strong><p>{{ n.text }}</p></div>
                  </div>
                }
              </div>
            }
            @if (!historical() && stagCards().length) {
              <h3 class="stag-h">Mudar o estímulo</h3>
              <app-suggestion-cards [cards]="stagCards()" (changed)="loadStagCards()" />
            }
            @if (historical()) {
              <ion-button expand="block" (click)="saveDetails()">Guardar</ion-button>
              <ion-button expand="block" fill="clear" color="danger" (click)="discard()">Apagar sessão</ion-button>
            } @else {
              <ion-button expand="block" (click)="finish()">Terminar e guardar</ion-button>
              <ion-button expand="block" fill="clear" color="danger" (click)="discard()">Descartar sessão</ion-button>
            }
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .today { margin: 4px 12px 8px; padding: 10px 12px; border-radius: 12px; background: var(--ion-color-step-50, rgba(128,128,128,.08)); }
    .today.up { background: rgba(var(--ion-color-primary-rgb), .12); }
    .today.down { background: rgba(var(--ion-color-warning-rgb), .14); }
    .today-main { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .today .lbl { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--ion-color-medium); }
    .today strong { font-size: 18px; }
    .today .tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .today.down .tag { background: var(--ion-color-warning); color: var(--ion-color-warning-contrast); }
    .opts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .opts button { font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--ion-color-medium); background: none; color: inherit; }
    .opts button.on { border-color: var(--ion-color-primary); background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .why { margin: 6px 0 0; font-size: 12px; color: var(--ion-color-medium); line-height: 1.4; }
    .deload { display: flex; align-items: center; gap: 8px; margin: 8px 12px; padding: 10px 12px; border-radius: 12px; font-size: 14px; background: rgba(var(--ion-color-tertiary-rgb, 128,128,128), .14); }
    .deload > div { flex: 1; }
    .stag-h { font-size: 15px; margin: 14px 0 6px; }
    .next { margin: 12px 0; }
    .next h3 { font-size: 15px; margin: 0 0 6px; }
    .next-row { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid rgba(128,128,128,.15); }
    .next-row ion-icon { font-size: 18px; margin-top: 2px; color: var(--ion-color-medium); flex: 0 0 auto; }
    .next-row.up ion-icon { color: var(--ion-color-primary); }
    .next-row.down ion-icon { color: var(--ion-color-warning); }
    .next-row strong { font-size: 14px; }
    .next-row p { margin: 2px 0 0; font-size: 13px; color: var(--ion-color-medium); }
    .whybtn { font: inherit; font-size: 12px; font-weight: 600; border: 0; background: none; color: var(--ion-color-primary); padding: 0 2px; }
    .rulewhy { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(128,128,128,.2); }
    .page { max-width: 760px; margin: 0 auto; padding: 8px 12px 24px; }
    .center { display: grid; place-items: center; height: 60vh; }
    .day { margin: 2px 4px 8px; color: var(--ion-color-medium); font-size: 0.9rem; }
    .gap { margin-top: 8px; }
    .live { display: flex; align-items: center; gap: 8px; width: 100%; margin: 10px 0 0; padding: 12px 14px; border: 0; border-radius: 14px; font: inherit; text-align: left;
      background: rgba(var(--ion-color-primary-rgb), 0.14); color: var(--ion-color-primary); }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.25; } }
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
    .ss { color: var(--ion-color-primary); font-weight: 600; }
    .warn { margin: 8px 0; padding: 8px 12px; border-radius: 10px; font-size: 0.85rem;
      background: var(--ion-color-warning-tint, #fff3cd); color: var(--ion-color-warning-shade, #6b5200); }
    .hint { text-align: center; color: var(--ion-color-medium); margin: 24px 0; }
    .footer { max-width: 760px; margin: 0 auto; padding: 4px 12px; }
    .start-pill { margin: 0 auto 8px; width: fit-content; padding: 4px 12px; border-radius: 999px; font-size: 0.8rem;
      background: rgba(var(--ion-color-primary-rgb), 0.12); color: var(--ion-color-primary); }
    .muscles { margin-top: 12px; padding: 10px 12px 6px; border-radius: 14px; background: var(--ion-card-background, var(--ion-item-background)); }
    .muscles h3 { margin: 0 0 4px; font-size: 0.95rem; }
    .muscles .muted { margin: 0 0 6px; text-align: center; font-size: 0.8rem; color: var(--ion-color-medium); }
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
  private readonly toasts = inject(ToastService);
  private readonly nav = inject(NavController);
  private readonly body = inject(BodyProfileService);
  private readonly cardioRuns = inject(CardioRunService);
  private readonly healthSvc = inject(HealthService);

  /** Id na rota (/historico/:id): abre uma sessão já terminada para corrigir. Sem id, é a sessão em curso. */
  readonly id = input<string | undefined>();
  /** ?fim=1: chega do cardio ao vivo com um só exercício, e abre logo o painel de terminar. */
  readonly fim = input<string | undefined>();
  /** ?add=1: chega do cardio ao vivo depois de escolheres «Adicionar exercício», e abre logo a lista. */
  readonly add = input<string | undefined>();
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

  readonly historical = computed(() => !!this.session()?.endedAt);
  readonly dayLabel = computed(() => formatDay(this.session()?.startedAt ?? this.clock.nowIso()));
  readonly elapsed = computed(() => {
    const s = this.session();
    if (!s) return '0:00';
    const end = s.endedAt ? Date.parse(s.endedAt) : this.now();
    return formatClock((end - Date.parse(s.startedAt)) / 1000 - s.pausedSeconds);
  });
  /** Dados do relógio de uma sessão terminada (FC média e calorias reais), se já foram importados. */
  private readonly health = resource({
    params: () => (this.session()?.endedAt ? this.session()!.id : undefined),
    loader: ({ params }) => this.healthSvc.summary(params),
  });
  readonly stats = computed(() => {
    const s = this.session();
    return s ? sessionStats(s, this.now(), this.body.profile(), this.health.value()?.avg ?? null) : null;
  });
  /** Índices principais: tempo, calorias, tempo ativo e descanso. */
  readonly mainTiles = computed<StatTile[]>(() => {
    const st = this.stats();
    if (!st) return [];
    const real = this.health.value()?.caloriesKcal ?? null;
    const kcal = real ?? st.loggedKcal ?? st.estimatedKcal;
    const hint = real !== null ? 'ativas · relógio' : st.loggedKcal !== null ? 'registado' : st.estimatedKcal !== null ? 'estimado' : 'sem peso';
    return [
      { label: 'Duração', value: formatClock(this.waiting() ? 0 : st.totalSeconds), tone: 'primary' },
      { label: 'Calorias', value: kcal === null ? '—' : String(kcal), unit: kcal === null ? undefined : 'kcal', tone: 'danger', hint },
      { label: 'Ativo', value: formatClock(st.activeSeconds), tone: 'success' },
      { label: 'Descanso', value: formatClock(st.restSeconds), tone: 'secondary' },
    ];
  });
  /** Índices secundários, só os que têm valor. */
  readonly extraTiles = computed<StatTile[]>(() => {
    const st = this.stats();
    if (!st) return [];
    const out: StatTile[] = [{ label: 'Séries', value: String(st.sets), tone: 'medium' }];
    if (st.volumeKg > 0) out.push({ label: 'Volume', value: st.volumeKg.toLocaleString('pt-PT'), unit: 'kg', tone: 'medium' });
    if (st.distanceM > 0) {
      out.push({ label: 'Distância', value: (st.distanceM / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 2 }), unit: 'km', tone: 'medium' });
      const p = paceOf(st.distanceM, st.activeSeconds);
      if (p && p.kmh <= 60) out.push({ label: 'Vel. média', value: p.kmh.toLocaleString('pt-PT', { maximumFractionDigits: 1 }), unit: 'km/h', tone: 'medium' });
    }
    const h = this.health.value();
    if (h?.avg) out.push({ label: 'FC média', value: String(h.avg), unit: 'bpm', tone: 'danger' });
    if (h?.max) out.push({ label: 'FC máx.', value: String(h.max), unit: 'bpm', tone: 'danger' });
    if (h?.caloriesTotalKcal) out.push({ label: 'Cal. totais', value: String(h.caloriesTotalKcal), unit: 'kcal', tone: 'medium', hint: 'com repouso' });
    if (h?.hrRecoveryBpm) out.push({ label: 'Recuperação', value: `−${h.hrRecoveryBpm}`, unit: 'bpm', tone: 'medium', hint: 'em 1 min' });
    if (!out.some((t) => t.label === 'Distância') && !out.some((t) => t.label === 'Volume')) out.push({ label: 'Exercícios', value: String(st.exercises), tone: 'medium' });
    return out.slice(0, 8);
  });
  /** Atividade de cardio a decorrer num exercício desta sessão. */
  readonly liveRun = computed(() => {
    const r = this.cardioRuns.run();
    const s = this.session();
    return r && s && !s.endedAt && s.exercises.some((e) => e.id === r.exerciseId) ? r : null;
  });
  readonly allTiles = computed(() => [...this.mainTiles(), ...this.extraTiles()]);
  readonly blocks = computed(() => {
    const s = this.session();
    if (!s) return [];
    return BLOCK_ORDER.map((block) => ({ block, items: s.exercises.filter((e) => e.block === block) })).filter((b) => b.items.length);
  });
  private readonly exerciseRepo = inject(EXERCISE_REPOSITORY);
  private readonly effort = inject(EffortReminder);
  /** Músculos primários (ids do spec) de cada exercício da sessão. */
  private readonly primaryMuscles = resource({
    params: () => [...new Set((this.session()?.exercises ?? []).map((e) => e.exerciseId))].sort().join(','),
    loader: async ({ params }) => {
      const out = new Map<string, MetricExercise & { support: string[]; figPrimary: string[]; figSupport: string[]; figInfo: PortionProfile['info'] }>();
      for (const id of params ? params.split(',') : []) {
        const ex = await this.exerciseRepo.get(id);
        out.set(id, {
          id, primaryMuscles: specOfMuscleIds(ex?.primaryMuscleIds ?? []), secondaryMuscles: [], support: specOfMuscleIds(ex?.secondaryMuscleIds ?? []),
          ...figOf(ex),
        });
      }
      return out;
    },
  });
  /** Músculos já trabalhados na sessão (exercícios de musculação com séries registadas), para o boneco. */
  readonly trained = computed(() => {
    const s = this.session();
    const exs = this.primaryMuscles.value();
    type Sets = { primary: Set<string>; support: Set<string> };
    const mk = (): Sets => ({ primary: new Set(), support: new Set() });
    const both = mk(), left = mk(), right = mk();
    const info: PortionProfile['info'] = {};
    let split = false;
    if (s && exs) {
      for (const e of s.exercises) {
        if (e.kind !== 'STRENGTH' || !e.sets.length) continue;
        const m = exs.get(e.exerciseId);
        if (!m) continue;
        // lados com séries registadas: BOTH conta para os dois
        const sides = new Set(e.sets.map((x) => x.side));
        const l = sides.has('BOTH') || sides.has('LEFT');
        const r = sides.has('BOTH') || sides.has('RIGHT');
        if (l !== r) split = true;
        for (const [on, tgt] of [[l, left], [r, right]] as const) {
          if (!on) continue;
          m.figPrimary.forEach((x) => tgt.primary.add(x));
          m.figSupport.forEach((x) => tgt.support.add(x));
        }
        m.figPrimary.forEach((x) => both.primary.add(x));
        m.figSupport.forEach((x) => both.support.add(x));
        // fonte por porção: a de um exercício onde é principal ganha à de um onde é secundária
        for (const [id, inf] of Object.entries(m.figInfo) as [PortionId, PortionInfo][]) {
          const cur = info[id];
          if (!cur || (cur.role === 'secondary' && inf.role === 'primary') || (cur.role === inf.role && inf.confidence < cur.confidence)) info[id] = inf;
        }
      }
    }
    const out = (x: Sets) => ({ primary: [...x.primary], secondary: [...x.support] });
    return { primary: [...both.primary], support: [...both.support], info, bySide: split ? { left: out(left), right: out(right) } : null };
  });
  readonly hasStrength = computed(() => (this.session()?.exercises ?? []).some((e) => e.kind === 'STRENGTH'));
  /** Sessão livre que ainda não começou: sem exercícios, ou à espera do pequeno timer de arranque. */
  readonly startIn = signal<number | null>(null);
  readonly waiting = computed(() => {
    const s = this.session();
    return !!s && !s.endedAt && !s.templateId && (!s.exercises.length || this.startIn() !== null);
  });
  /** Aviso quando uma sessão passa das séries diretas úteis por músculo (só em sessão em curso). */
  readonly warnings = computed<string[]>(() => {
    const s = this.session();
    const exs = this.primaryMuscles.value();
    if (!s || !exs || s.endedAt) return [];
    const sets: MetricSet[] = [];
    for (const e of s.exercises) {
      if (e.kind !== 'STRENGTH') continue;
      for (const g of groupSets(e.sets)) {
        const x = g.sets[0];
        if (g.type !== 'WORKING' || !x?.completedAt) continue;
        sets.push({ exerciseId: e.exerciseId, sessionId: s.id, weightKg: x.weightKg ?? 0, reps: x.reps ?? 0, rir: x.rir,
          type: 'working', performedAt: new Date(x.completedAt) });
      }
    }
    return sessionWarnings(sets, exs, MUSCLE_LABEL);
  });

  readonly totalSets = computed(() => (this.session()?.exercises ?? []).reduce((n, e) => n + groupSets(e.sets).length, 0));
  readonly sheetExercise = computed(() => {
    const sh = this.sheet();
    return sh ? (this.session()?.exercises.find((e) => e.id === sh.exerciseId) ?? null) : null;
  });
  readonly sheetSides = computed<Side[]>(() => (this.sheetExercise()?.isUnilateral ? ['LEFT', 'RIGHT'] : ['BOTH']));

  constructor() {
    addIcons({ add, arrowDown, arrowUp, checkmarkCircle, ellipseOutline, play, remove, stopwatchOutline, trashOutline });
    // Sugestão de carga para os exercícios da sessão (os novos também, quando os juntas).
    effect(() => {
      const s = this.session();
      if (s) untracked(() => void this.loadSuggestions(s));
    });
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
    if (this.startTimer) {
      clearInterval(this.startTimer);
      this.startTimer = null;
      const id = this.session()?.id;
      if (id) void this.repo.restartClock(id).catch(() => undefined);
    }
  }

  async ionViewWillEnter(): Promise<void> {
    this.body.reload();
    const id = this.id();
    const found = id ? await this.repo.get(id) : await this.repo.getActive();
    if (!found) {
      this.nav.navigateRoot(id ? '/historico' : '/treinos');
      return;
    }
    this.session.set(found);
    if (this.fim() === '1' && !found.endedAt) this.openDetails();
    else if (this.add() === '1' && !found.endedAt) void this.addExercises();
    else if (!id && !found.templateId && !found.exercises.length && !this.autoPicked) {
      // Sessão livre acabada de abrir: vai direto à escolha do primeiro exercício.
      this.autoPicked = true;
      void this.addExercises();
    }
  }

  startCardio(ex: SessionExercise): void {
    void this.nav.navigateForward(['/sessao/cardio', ex.id]);
  }
  openLive(exerciseId: string): void {
    void this.nav.navigateForward(['/sessao/cardio', exerciseId]);
  }

  groups = (ex: SessionExercise) => groupSets(ex.sets);
  format = (ex: SessionExercise, g: ReturnType<typeof groupSets>[number]) => formatSetGroup(ex, g);
  targets = (ex: SessionExercise) =>
    formatTargets(ex.kind, ex.metricType, ex.isUnilateral, {
      targetSets: ex.targetSets, targetRepsMin: ex.targetRepsMin, targetReps: ex.targetReps, targetDurationSeconds: ex.targetDurationSeconds,
      targetWeightKg: ex.targetWeightKg, targetDistanceM: ex.targetDistanceM, restSeconds: ex.restSeconds,
    }) || 'Sem alvo';
  isDone = (ex: SessionExercise) => !!ex.targetSets && workingSetCount(ex) >= this.setsFor(ex);
  /** Séries de hoje: as do ciclo (multiplicador da semana) ou, numa descarga fora do ciclo, metade. */
  setsFor = (ex: SessionExercise): number => {
    const t = ex.targetSets ?? 0;
    const c = this.cycle();
    if (c) return weekSets(c.a.pos.week, t);
    return this.deload() ? this.deloadSets(ex) : t;
  };
  // --- ciclo ---
  private readonly cycles = inject(CycleService);
  readonly cycle = signal<{ a: ActiveCycle; reps: [number, number] | null } | null>(null);
  private cycleLoaded: Promise<void> | null = null;
  private loadCycle(s: Session): Promise<void> {
    return (this.cycleLoaded ??= (async () => {
      const a = await this.cycles.active();
      this.cycle.set(a ? { a, reps: await this.cycles.repsFor(a, s.id) } : null);
    })());
  }
  readonly cycleWeek = computed(() => {
    const c = this.cycle();
    if (!c) return null;
    const p = c.a.pos;
    return { block: p.block.name, week: p.weekIndex + 1, weeks: p.block.weeks.length, type: WEEK_LABEL[p.week.type].toLowerCase(), rir: p.week.rir };
  });
  /** Descarga por resposta/definições ou por ser semana de descarga do ciclo. */
  private deloadNow = () => !!this.progression.deload() || this.cycle()?.a.pos.week.type === 'deload';
  /** Semana de descarga: metade das séries (arredondado para cima; escolha da app, rules.ts `deload.amount`). */
  deloadSets = (ex: SessionExercise) => Math.max(1, Math.ceil((ex.targetSets ?? 0) / 2));
  private readonly progression = inject(ProgressionService);
  readonly deload = computed(() => (this.settings.get('deloadUntil')(), this.progression.deload()));
  async endDeload(): Promise<void> {
    await this.progression.endDeload();
    await this.toast('Descarga terminada.');
  }
  // --- estagnação (painel final) ---
  readonly stagCards = signal<SuggestionCard[]>([]);
  async loadStagCards(): Promise<void> {
    const s = this.session();
    if (!s || s.endedAt) return;
    const ids = [...new Set(s.exercises.filter((e) => e.kind === 'STRENGTH' && e.sets.length).map((e) => e.exerciseId))];
    this.stagCards.set(ids.length ? await this.progression.cards({ exerciseIds: ids }) : []);
  }

  // --- sugestão de carga ----------------------------------------------------------------------------
  /** Sugestão por exercício da sessão (id do session_exercise). Calculada uma vez, a partir das sessões anteriores. */
  readonly suggestions = signal<ReadonlyMap<string, LoadSuggestion>>(new Map());
  /** Carga escolhida noutra opção (toque num chip); por defeito vale a sugerida. */
  readonly chosen = signal<ReadonlyMap<string, number>>(new Map());
  private readonly asked = new Set<string>();
  suggestionOf = (ex: SessionExercise): LoadSuggestion | null => this.suggestions().get(ex.id) ?? null;
  todayKg = (ex: SessionExercise): number | null => this.chosen().get(ex.id) ?? this.suggestionOf(ex)?.weightKg ?? null;
  choose(ex: SessionExercise, kg: number): void {
    this.chosen.update((m) => new Map(m).set(ex.id, kg));
  }
  /** Exercícios com o «Porquê?» aberto. */
  readonly whyOpen = signal<ReadonlySet<string>>(new Set());
  toggleWhy(id: string): void {
    this.whyOpen.update((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  kgLabel = (x: number) => `${x.toLocaleString('pt-PT', { maximumFractionDigits: 2 })} kg`;

  private async loadSuggestions(s: Session): Promise<void> {
    if (s.endedAt || !this.settings.get('loadSuggestions')()) return;
    await this.loadCycle(s);
    const todo = s.exercises.filter((e) => e.kind === 'STRENGTH' && e.metricType === 'WEIGHT_REPS' && !this.asked.has(e.id));
    if (!todo.length) return;
    for (const e of todo) this.asked.add(e.id);
    const found = new Map(this.suggestions());
    for (const e of todo) found.set(e.id, await this.suggestFor(e, s.id));
    this.suggestions.set(found);
  }

  /** Sugestão de carga de um exercício a partir das sessões terminadas; `today` entra como a mais recente («Próxima vez»). */
  private async suggestFor(e: SessionExercise, sessionId: string, today?: SessionSet[]): Promise<LoadSuggestion> {
    const increments = this.settings.get('loadIncrements')();
    const recent = await this.repo.recentSets(e.exerciseId, sessionId, today ? 2 : 3);
    const working = (sets: SessionSet[]) => ({
      sets: sets.filter((x) => x.type === 'WORKING').map((x) => ({ weightKg: x.weightKg, reps: x.reps, rir: x.rir })),
    });
    const history = [...(today ? [working(today)] : []), ...recent.map(working)];
    const goal = this.settings.get('profileGoal')();
    const [min, max] = this.cycle()?.reps ?? repRange(e, defaultRepRange(goal, this.settings.get('profileLevel')()));
    const key = e.equipmentId ? EQUIPMENT_KEY.get(e.equipmentId) : undefined;
    const inc = key ? (increments[key] ?? null) : null;
    const sg = suggestLoad({ history, repsMin: min, repsMax: max, mechanic: e.mechanic, incrementKg: inc });
    // Objetivo Força: ~80% do 1RM estimado (ACSM 2026, comunicado), a partir das séries até 10 repetições.
    if (goal === 'strength' && !today) {
      const e1 = Math.max(0, ...history.flatMap((h) => h.sets.map((x) => reliable1RM(x.weightKg, x.reps, x.rir) ?? 0)));
      if (e1 > 0) sg.strength = { e1rm: Math.round(e1 * 10) / 10, kg: strengthTarget(e1, inc) };
    }
    // Semana de descarga: a mesma carga, sem subir (Bell 2023: o volume cai, a intensidade pode manter-se).
    if (!today && this.deloadNow() && sg.action === 'increase') {
      const last = Math.max(0, ...(history[0]?.sets ?? []).map((x) => x.weightKg ?? 0));
      return { ...sg, action: 'hold', weightKg: last || null, options: [], rangeKg: null, rule: 'deload.how',
        reason: `Semana de descarga: mantém ${this.kgLabel(last)}; a subida fica para depois.` };
    }
    return sg;
  }

  // --- próxima vez (painel final) ----------------------------------------------------------------------
  /** Para cada exercício de carga feito hoje: o que a app vai sugerir na próxima sessão. */
  readonly nextTime = signal<{ id: string; name: string; action: LoadSuggestion['action']; text: string }[]>([]);
  private async loadNextTime(s: Session): Promise<void> {
    if (!this.settings.get('loadSuggestions')()) { this.nextTime.set([]); return; }
    const out: { id: string; name: string; action: LoadSuggestion['action']; text: string }[] = [];
    for (const e of s.exercises) {
      if (e.kind !== 'STRENGTH' || e.metricType !== 'WEIGHT_REPS' || !e.sets.some((x) => x.type === 'WORKING' && x.weightKg)) continue;
      const sg = await this.suggestFor(e, s.id, e.sets);
      out.push({ id: e.id, name: e.exerciseName, action: sg.action, text: nextTimeText(sg, this.kgLabel) });
    }
    this.nextTime.set(out);
  }
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
    const wasEmpty = !s.exercises.length && !s.templateId;
    for (const e of data) await this.repo.addExercise(s.id, e.id, 'MAIN');
    const updated = (await this.repo.get(s.id)) ?? s;
    this.session.set(updated);
    if (wasEmpty) this.beginFreeSession(updated);
  }

  private startTimer: ReturnType<typeof setInterval> | null = null;
  private autoPicked = false;

  /**
   * Sessão livre: o relógio só arranca depois de escolheres o primeiro exercício, com uma contagem curta e discreta (3 s).
   * Se esse exercício é de cardio, é o próprio ecrã da atividade (botão «Começar» e contagem de 5 s) que arranca o relógio.
   */
  private beginFreeSession(s: Session): void {
    const first = firstExercise(s);
    if (first?.kind === 'CARDIO') {
      this.startCardio(first);
      return;
    }
    this.startIn.set(3);
    this.startTimer = setInterval(() => {
      const n = (this.startIn() ?? 1) - 1;
      if (n > 0) {
        this.startIn.set(n);
        return;
      }
      clearInterval(this.startTimer!);
      this.startTimer = null;
      void this.repo.restartClock(s.id).then(async () => {
        this.session.set((await this.repo.get(s.id)) ?? s);
        this.startIn.set(null);
      });
    }, 1000);
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
      // Primeira série de trabalho do exercício hoje: carga sugerida e, depois de subir ou descer, o mínimo da faixa.
      const sg = this.suggestionOf(ex);
      const kg = this.todayKg(ex);
      if (sg && kg !== null && !ex.sets.some((x) => x.type === 'WORKING')) {
        for (const side of sidesList) {
          const f = sides[side] ?? { ...EMPTY };
          sides[side] = { ...f, weight: String(kg), reps: sg.action === 'hold' && f.reps ? f.reps : String(sg.repsMin) };
        }
      }
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
  setField(side: Side, key: Exclude<keyof SideForm, 'rom' | 'rir'>, value: string | null | undefined): void {
    this.sheet.update((s) => (s ? { ...s, sides: { ...s.sides, [side]: { ...(s.sides[side] ?? EMPTY), [key]: value ?? '' } } } : s));
  }
  toggleRom(side: Side, n: number): void {
    this.sheet.update((s) =>
      s ? { ...s, sides: { ...s.sides, [side]: { ...(s.sides[side] ?? EMPTY), rom: s.sides[side]?.rom === n ? null : n } } } : s,
    );
  }
  sheetRir(side: Side): number | null {
    return this.sheet()?.sides[side]?.rir ?? null;
  }
  toggleRir(side: Side, n: number): void {
    this.sheet.update((s) =>
      s ? { ...s, sides: { ...s.sides, [side]: { ...(s.sides[side] ?? EMPTY), rir: s.sides[side]?.rir === n ? null : n } } } : s,
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
        rir: ex.kind === 'STRENGTH' && sh.type === 'WORKING' ? f.rir : null,
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
      if (isNew && !this.historical()) this.startRest(updated);
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
    const next = this.supersetNext(ex);
    if (next) {
      // Superset: sem descanso entre os exercícios do grupo; descansa-se depois do último.
      void this.toast(`Superset: segue para ${next.exerciseName}.`);
      return;
    }
    const seconds = ex.restSeconds
      ?? (ex.kind === 'STRENGTH' ? defaultRest(ex.mechanic, this.settings.get('restByMechanic')(), this.settings.get('defaultRestSeconds')(), this.settings.get('profileGoal')()) : 0);
    if (seconds > 0) this.timer.start('REST', ex.exerciseName, seconds);
  }

  /** Exercícios do mesmo superset (por ordem); vazio se o exercício não está em nenhum. */
  private supersetMembers(ex: SessionExercise): SessionExercise[] {
    if (!ex.supersetGroup) return [];
    return (this.session()?.exercises ?? [])
      .filter((e) => e.block === ex.block && e.supersetGroup === ex.supersetGroup)
      .sort((a, b) => a.position - b.position);
  }
  /** O exercício a fazer a seguir dentro do superset, ou null se este é o último (ou não há superset). */
  private supersetNext(ex: SessionExercise): SessionExercise | null {
    const m = this.supersetMembers(ex);
    const i = m.findIndex((e) => e.id === ex.id);
    return m.length > 1 && i >= 0 && i < m.length - 1 ? m[i + 1] : null;
  }
  ssLabel(ex: SessionExercise): string | null {
    const m = this.supersetMembers(ex);
    return m.length > 1 ? `Superset ${ex.supersetGroup} · ${m.findIndex((e) => e.id === ex.id) + 1}/${m.length}` : null;
  }

  // --- terminar -----------------------------------------------------------------------------------

  /** Abre o painel final: terminar (sessão em curso) ou corrigir esforço e notas (sessão terminada). */
  openDetails(): void {
    const s = this.session();
    this.finishRpe.set(s?.rpe === null || s?.rpe === undefined ? '' : String(s.rpe));
    this.finishNotes.set(s?.notes ?? '');
    this.finishOpen.set(true);
    if (s && !s.endedAt) { void this.loadNextTime(s); void this.loadStagCards(); }
  }

  async saveDetails(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const updated = await this.repo.updateDetails(s.id, { rpe: toNum(this.finishRpe()), notes: this.finishNotes() });
    this.session.set(updated);
    if (updated.rpe !== null) void this.effort.cancel();
    this.finishOpen.set(false);
    await this.toast('Detalhes guardados.');
  }

  async finish(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const rpe = toNum(this.finishRpe());
    await this.repo.finish(s.id, { rpe, notes: this.finishNotes() });
    if (rpe === null && this.totalSets() > 0) void this.effort.schedule(s.id); // sRPE: pergunta ~30 min depois
    this.timer.stop();
    this.finishOpen.set(false);
    await this.toast('Sessão guardada.');
    this.nav.navigateRoot('/home');
  }

  async discard(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const alert = await this.alerts.create({
      header: this.historical() ? 'Apagar a sessão?' : 'Descartar a sessão?',
      message: this.historical() ? 'Sai do histórico e das estatísticas. Não dá para desfazer.' : 'Perdes tudo o que registaste nesta sessão.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: this.historical() ? 'Apagar' : 'Descartar',
          role: 'destructive',
          handler: () => {
            void (async () => {
              await this.repo.discard(s.id);
              this.timer.stop();
              this.finishOpen.set(false);
              this.nav.navigateRoot(this.historical() ? '/historico' : '/home');
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
      distance: str(s.distanceM === null ? null : s.distanceM / 1000), calories: str(s.caloriesKcal, 0), rom: s.romScore, rir: s.rir,
    };
  }

  private fromTargets(ex: SessionExercise): SideForm {
    return {
      weight: str(ex.targetWeightKg), reps: str(ex.targetReps, 0),
      duration: ex.kind === 'CARDIO' ? str(ex.targetDurationSeconds === null ? null : ex.targetDurationSeconds / 60) : str(ex.targetDurationSeconds, 0),
      distance: str(ex.targetDistanceM === null ? null : ex.targetDistanceM / 1000), calories: '', rom: null, rir: null,
    };
  }

  private async toast(message: string): Promise<void> {
    await this.toasts.show(message, 'success', 1800);
  }
}
