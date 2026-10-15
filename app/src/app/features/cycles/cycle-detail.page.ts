import { Component, computed, inject, input, resource, signal } from '@angular/core';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonModal,
  IonSegment, IonSegmentButton, IonSpinner, IonTitle, IonToggle, IonToolbar, NavController,
} from '@ionic/angular';
import { CLOCK } from '../../core/util/clock';
import { addDays, toLocalDate } from '../../core/util/week';
import { CYCLE_REPOSITORY, SCHEDULED_REPOSITORY, WORKOUT_REPOSITORY } from '../../data/repositories/providers';
import { CycleService } from '../../core/progression/cycle.service';
import { frequencyWarnings } from '../../core/progression/cycle-schedule';
import { MUSCLE_LABEL } from '../../core/metrics/muscles';
import { WeekPatternComponent } from '../../shared/week-pattern.component';
import { askConflicts } from './conflicts';
import {
  endDate, FOCUS_LABEL, positionOn, TEMPLATE, totalWeeks, WEEK_LABEL, type Cycle, type CycleWeek, type WeekType,
} from '../../core/progression/cycles';
import { GOAL_LABEL } from '../../core/progression/goals';
import { RuleWhyComponent } from '../../shared/rule-why.component';
import { ToastService } from '../../core/ui/toast.service';

const fmt = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '');
const num = (v: unknown): number | null => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return String(v ?? '').trim() === '' || !Number.isFinite(n) ? null : n;
};

/** Um ciclo: linha do tempo dos mesociclos e semanas; tocar numa semana edita o tipo e os três ajustes. */
@Component({
  selector: 'app-cycle-detail',
  imports: [RuleWhyComponent, WeekPatternComponent, IonToggle, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonList, IonItem,
    IonLabel, IonInput, IonModal, IonSegment, IonSegmentButton, IonSpinner],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/ciclos" /></ion-buttons>
        <ion-title>{{ cycle()?.name ?? 'Ciclo' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @if (!cycle()) {
        <div class="center"><ion-spinner /></div>
      } @else {
        <div class="page">
          <p class="meta">{{ meta() }}</p>
          <p class="legend">
            @for (t of types; track t) { <span class="chip t-{{ t }}">{{ weekLabel[t] }}</span> }
          </p>
          @for (b of view(); track $index; let bi = $index) {
            <section class="block">
              <h3>{{ b.name }} <span class="focus">{{ b.focus }}</span></h3>
              <p class="sub">Semana-tipo</p>
              <app-week-pattern [days]="b.pattern" [workouts]="workouts()" (changed)="setPattern(bi, $event)" />
              @if (b.warnings.length) { <p class="warn">Só 1× por semana: {{ b.warnings }}. O ACSM 2026 recomenda cada grupo grande pelo menos 2× por semana.</p> }
              <div class="weeks">
                @for (w of b.weeks; track $index; let wi = $index) {
                  <button type="button" class="week t-{{ w.week.type }}" [class.now]="w.now" (click)="edit(bi, wi)">
                    <span class="n">S{{ w.number }}</span>
                    <span class="d">{{ w.date }}</span>
                    <span class="r">{{ w.reps }}</span>
                    <span class="s">×{{ dec(w.week.sets) }}@if (w.week.rir !== null) { · RIR {{ w.week.rir }} }</span>
                    @if (w.trainings !== null) { <span class="s">{{ w.trainings }} treinos@if (w.week.days) { · próprios }</span> }
                  </button>
                }
              </div>
            </section>
          }
          <app-rule-why class="why" [key]="templateRule()" />
          <app-rule-why class="why" key="cycle.week" />
          <div class="actions">
            <ion-button fill="outline" (click)="archive()">Arquivar</ion-button>
            <ion-button fill="clear" color="danger" (click)="remove()">Apagar</ion-button>
          </div>
        </div>
      }

      <ion-modal [isOpen]="editing() !== null" (didDismiss)="editing.set(null)" [initialBreakpoint]="0.75" [breakpoints]="[0, 0.75, 1]">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>Semana {{ editingNumber() }}</ion-title>
              <ion-buttons slot="end"><ion-button (click)="saveWeek()">Guardar</ion-button></ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            @if (draft(); as d) {
              <div class="sheet">
                <ion-segment [value]="d.type" (ionChange)="patch({ type: $any($event).detail.value })">
                  @for (t of types; track t) { <ion-segment-button [value]="t"><ion-label>{{ weekLabel[t] }}</ion-label></ion-segment-button> }
                </ion-segment>
                <ion-list lines="full">
                  <ion-item>
                    <ion-input label="Repetições mín." labelPlacement="stacked" type="number" inputmode="numeric" placeholder="Do treino"
                      [value]="d.min" (ionInput)="patch({ min: $any($event).detail.value })" />
                    <ion-input label="Repetições máx." labelPlacement="stacked" type="number" inputmode="numeric" placeholder="Do treino"
                      [value]="d.max" (ionInput)="patch({ max: $any($event).detail.value })" />
                  </ion-item>
                  <ion-item>
                    <ion-input label="Multiplicador de séries" labelPlacement="stacked" type="number" inputmode="decimal" step="0.1" min="0.1" max="3"
                      [value]="d.sets" (ionInput)="patch({ sets: $any($event).detail.value })" />
                    <ion-input label="RIR alvo" labelPlacement="stacked" type="number" inputmode="numeric" min="0" max="5" placeholder="Do nível"
                      [value]="d.rir" (ionInput)="patch({ rir: $any($event).detail.value })" />
                  </ion-item>
                </ion-list>
                <div class="own">
                  <ion-toggle [checked]="d.ownDays" (ionChange)="patchDays($any($event).detail.checked)">Dias diferentes nesta semana</ion-toggle>
                </div>
                @if (d.ownDays) {
                  <app-week-pattern [days]="d.days" [workouts]="workouts()" (changed)="draft.set({ ...d, days: $event })" />
                }
                @if (d.undulating) { <p class="hint">Semana ondulatória: {{ d.undulating }}. Escrever uma faixa troca-a por uma fixa.</p> }
                <p class="hint">Vazio = fica o que o treino diz. 1 = séries como estão; 0,5 = metade.</p>
              </div>
            }
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; padding: 8px 12px 24px; }
    .center { display: flex; justify-content: center; padding: 40px; }
    .meta { margin: 4px 4px 8px; color: var(--ion-color-medium); font-size: 14px; }
    .legend { display: flex; gap: 6px; flex-wrap: wrap; margin: 0 4px 8px; }
    .chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; }
    .block h3 { font-size: 15px; margin: 14px 4px 6px; }
    .focus { font-size: 12px; font-weight: 400; color: var(--ion-color-medium); }
    .weeks { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; }
    .week { font: inherit; text-align: left; border: 1px solid transparent; border-radius: 10px; padding: 6px 8px; display: flex; flex-direction: column; gap: 1px; color: inherit; }
    .week.now { border-color: var(--ion-color-primary); box-shadow: 0 0 0 1px var(--ion-color-primary); }
    .week .n { font-weight: 700; font-size: 13px; }
    .week .d, .week .s { font-size: 11px; color: var(--ion-color-medium); }
    .week .r { font-size: 12px; }
    .t-normal { background: rgba(128,128,128,.12); }
    .t-overload { background: rgba(var(--ion-color-primary-rgb), .18); }
    .t-deload { background: rgba(var(--ion-color-tertiary-rgb, 128,128,200), .18); }
    .t-test { background: rgba(var(--ion-color-warning-rgb), .2); }
    .why { margin: 16px 4px 0; }
    .sub { margin: 0 4px 4px; font-size: 12px; color: var(--ion-color-medium); }
    .warn { margin: 6px 4px 0; font-size: 12px; color: var(--ion-color-warning-shade, #b26b00); }
    .weeks { margin-top: 8px; }
    .own { margin: 12px 4px 8px; }
    .actions { display: flex; gap: 8px; margin-top: 20px; }
    .sheet { padding: 12px; max-width: 560px; margin: 0 auto; }
    .hint { font-size: 13px; color: var(--ion-color-medium); margin: 8px 4px; }
    ion-item ion-input + ion-input { margin-inline-start: 12px; }
  `,
})
export class CycleDetailPage {
  readonly id = input.required<string>();
  private readonly repo = inject(CYCLE_REPOSITORY);
  private readonly workoutRepo = inject(WORKOUT_REPOSITORY);
  private readonly scheduledRepo = inject(SCHEDULED_REPOSITORY);
  private readonly cycles = inject(CycleService);
  private readonly clock = inject(CLOCK);
  private readonly alerts = inject(AlertController);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastService);
  readonly types: WeekType[] = ['normal', 'overload', 'deload', 'test'];
  readonly weekLabel = WEEK_LABEL;
  dec = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 2 });

  private readonly loaded = resource({ params: () => this.id(), loader: ({ params }) => this.repo.get(params) });
  readonly local = signal<Cycle | null>(null);
  readonly cycle = computed(() => this.local() ?? this.loaded.value() ?? null);

  readonly meta = computed(() => {
    const c = this.cycle()!;
    return `${GOAL_LABEL[c.goal]} · template ${TEMPLATE[c.template]?.name ?? c.template} · ${fmt(c.startDate)} a ${fmt(endDate(c))} · ${totalWeeks(c.plan)} semanas`;
  });
  readonly templateRule = computed(() => TEMPLATE[this.cycle()!.template]?.rule ?? 'cycle.levels');

  readonly view = computed(() => {
    const c = this.cycle();
    if (!c) return [];
    const now = positionOn(c, toLocalDate(this.clock.now()));
    let n = 0;
    return c.plan.blocks.map((b, bi) => ({
      name: b.name, focus: FOCUS_LABEL[b.focus], pattern: b.pattern ?? null,
      warnings: b.pattern ? frequencyWarnings(b.pattern, this.muscles()).map((m) => (MUSCLE_LABEL[m] ?? m).toLowerCase()).join(', ') : '',
      weeks: b.weeks.map((week, wi) => {
        const number = ++n;
        const reps = week.undulating?.length ? week.undulating.map(([a, z]) => `${a}–${z}`).join(' / ') : week.reps ? `${week.reps[0]}–${week.reps[1]}` : 'do treino';
        const days = week.days ?? b.pattern ?? null;
        return { week, number, date: fmt(addDays(c.startDate, (number - 1) * 7)), reps, now: !!now && now.blockIndex === bi && now.weekIndex === wi,
          trainings: days ? days.filter(Boolean).length : null };
      }),
    }));
  });

  // --- editar uma semana ---
  readonly editing = signal<[number, number] | null>(null);
  readonly draft = signal<{ type: WeekType; min: string; max: string; sets: string; rir: string; undulating: string | null; ownDays: boolean; days: (string | null)[] | null } | null>(null);
  patchDays(on: boolean): void {
    const e = this.editing();
    const b = e ? this.cycle()!.plan.blocks[e[0]] : null;
    this.draft.update((d) => (d ? { ...d, ownDays: on, days: on ? d.days ?? [...(b?.pattern ?? Array(7).fill(null))] : d.days } : d));
  }
  readonly editingNumber = computed(() => {
    const e = this.editing();
    const c = this.cycle();
    if (!e || !c) return '';
    return c.plan.blocks.slice(0, e[0]).reduce((n, b) => n + b.weeks.length, 0) + e[1] + 1;
  });

  edit(bi: number, wi: number): void {
    const w = this.cycle()!.plan.blocks[bi].weeks[wi];
    this.draft.set({
      type: w.type, min: w.reps ? String(w.reps[0]) : '', max: w.reps ? String(w.reps[1]) : '', sets: String(w.sets),
      rir: w.rir === null ? '' : String(w.rir), undulating: w.undulating?.map(([a, z]) => `${a}–${z}`).join(', ') ?? null,
      ownDays: !!w.days, days: w.days ? [...w.days] : null,
    });
    this.editing.set([bi, wi]);
  }
  patch(p: Partial<{ type: WeekType; min: string; max: string; sets: string; rir: string }>): void {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
  }

  async saveWeek(): Promise<void> {
    const e = this.editing();
    const d = this.draft();
    const c = this.cycle();
    if (!e || !d || !c) return;
    const min = num(d.min), max = num(d.max), sets = num(d.sets), rir = num(d.rir);
    if ((min === null) !== (max === null) || (min !== null && (min < 1 || max! < min || max! > 50))) {
      await this.toasts.error('Faixa inválida: indica mínimo e máximo (1–50), ou deixa os dois vazios.');
      return;
    }
    if (sets === null || sets < 0.1 || sets > 3) { await this.toasts.error('O multiplicador vai de 0,1 a 3.'); return; }
    if (rir !== null && (rir < 0 || rir > 5)) { await this.toasts.error('O RIR vai de 0 a 5.'); return; }
    const plan = JSON.parse(JSON.stringify(c.plan)) as Cycle['plan'];
    const old = plan.blocks[e[0]].weeks[e[1]];
    const week: CycleWeek = { type: d.type, reps: min !== null ? [min, max!] : null, sets: Math.round(sets * 100) / 100, rir: rir === null ? null : Math.round(rir) };
    if (old.undulating && min === null) week.undulating = old.undulating;
    if (d.ownDays && d.days) week.days = d.days;
    plan.blocks[e[0]].weeks[e[1]] = week;
    await this.savePlan(plan);
    this.editing.set(null);
  }

  // --- semana-tipo e Planeados ---
  readonly workouts = signal<{ id: string; name: string }[]>([]);
  private readonly muscles = signal<Map<string, string[]>>(new Map());

  constructor() {
    void (async () => {
      this.workouts.set((await this.workoutRepo.list()).map((w) => ({ id: w.id, name: w.name })));
      this.muscles.set(await this.cycles.workoutMuscles());
    })();
  }

  async setPattern(bi: number, days: (string | null)[]): Promise<void> {
    const c = this.cycle()!;
    const plan = JSON.parse(JSON.stringify(c.plan)) as Cycle['plan'];
    plan.blocks[bi].pattern = days;
    await this.savePlan(plan);
  }

  /** Guarda o plano e põe os Planeados em dia; pergunta nos conflitos com planeados teus. */
  private async savePlan(plan: Cycle['plan']): Promise<void> {
    const c = this.cycle()!;
    this.local.set(await this.repo.save({ id: c.id, name: c.name, goal: c.goal, template: c.template, startDate: c.startDate, notes: c.notes, plan }));
    await askConflicts(this.alerts, this.cycles, await this.cycles.syncSchedule(c.id));
    this.local.set(await this.repo.get(c.id));
  }

  async archive(): Promise<void> {
    const removed = await this.askRemovePlanned('Arquivar');
    if (removed === null) return;
    await this.repo.archive(this.id());
    await this.toasts.success('Ciclo arquivado.');
    void this.nav.navigateBack('/ciclos');
  }

  /** null = cancelado; true/false = tirar ou não os planeados futuros do ciclo. */
  private async askRemovePlanned(verb: string): Promise<boolean | null> {
    const n = (await this.scheduledRepo.cycleState(this.id(), [])).filter((r) => r.cycleId === this.id() && !r.deleted && r.status === 'PLANNED' && r.date >= toLocalDate(this.clock.now())).length;
    if (!n) return false;
    return new Promise((resolve) => {
      void this.alerts.create({
        header: `${verb} o ciclo`,
        message: `Este ciclo tem ${n} ${n === 1 ? 'treino planeado' : 'treinos planeados'} de hoje em diante. Tirar dos Planeados?`,
        buttons: [
          { text: 'Cancelar', role: 'cancel', handler: () => resolve(null) },
          { text: 'Manter', handler: () => resolve(false) },
          { text: 'Tirar', role: 'destructive', handler: () => { void this.cycles.removeFutureSchedule(this.id()).then(() => resolve(true)); } },
        ],
      }).then((a) => a.present());
    });
  }

  async remove(): Promise<void> {
    if ((await this.askRemovePlanned('Apagar')) === null) return;
    const a = await this.alerts.create({
      header: 'Apagar o ciclo?', message: 'Os treinos e o histórico não mudam; só o plano desaparece.',
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Apagar', role: 'destructive', handler: () => { void this.doRemove(); } }],
    });
    await a.present();
  }
  private async doRemove(): Promise<void> {
    await this.repo.remove(this.id());
    void this.nav.navigateBack('/ciclos');
  }
}
