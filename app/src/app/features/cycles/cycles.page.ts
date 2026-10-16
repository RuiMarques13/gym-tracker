import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonModal, IonNote,
  IonTitle, IonToolbar, NavController, ViewWillEnter, AlertController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
import { CLOCK } from '../../services/clock';
import { toLocalDate, weekStartOf } from '../../core/util/week';
import { CYCLE_REPOSITORY, WORKOUT_REPOSITORY } from '../../services/repositories';
import { CycleService } from '../../services/progression/cycle.service';
import { WeekPatternComponent } from '../../shared/week-pattern.component';
import { askConflicts } from './conflicts';
import { CycleError } from '../../data/repositories/cycle.repository';
import { endDate, planFrom, positionOn, TEMPLATES, totalWeeks, type Cycle, type TemplateId } from '../../core/progression/cycles';
import { GOAL_LABEL } from '../../core/progression/goals';
import { NavButtonComponent } from '../../shared/nav-button.component';
import { RuleWhyComponent } from '../../shared/rule-why.component';
import { ToastService } from '../../services/ui/toast.service';

const fmtDay = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');

/** Ciclos: a lista de macrociclos e criar um a partir de um template. Os ciclos são opcionais. */
@Component({
  selector: 'app-cycles',
  imports: [NavButtonComponent, RouterLink, RuleWhyComponent, WeekPatternComponent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
    IonList, IonListHeader, IonItem, IonLabel, IonNote, IonModal, IonInput],
  template: `
    <ion-header>
      <ion-toolbar>
        <app-nav-button slot="start" />
        <ion-title>Ciclos</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openNew()" aria-label="Novo ciclo"><ion-icon slot="icon-only" name="add" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <p class="intro">Um ciclo é um plano por cima dos teus treinos: cada semana diz que faixa de repetições, quantas séries e que esforço usar.
          É opcional; sem ciclo a app funciona como até aqui.</p>
        @if (rows().length) {
          <ion-list lines="full">
            @for (r of rows(); track r.c.id) {
              <ion-item [routerLink]="['/ciclos', r.c.id]" button [detail]="true">
                <ion-label>
                  <h2>{{ r.c.name }} @if (r.now) { <span class="now">em curso</span> }</h2>
                  <p>{{ r.when }} · {{ r.weeks }} semanas · {{ goalLabel[r.c.goal] }}</p>
                  @if (r.now) { <p>{{ r.now }}</p> }
                </ion-label>
              </ion-item>
            }
          </ion-list>
        } @else if (!list.isLoading()) {
          <div class="empty">
            <p>Ainda não tens ciclos.</p>
            <ion-button (click)="openNew()">Criar a partir de um template</ion-button>
          </div>
        }
      </div>

      <ion-modal [isOpen]="newOpen()" (didDismiss)="newOpen.set(false)">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>Novo ciclo</ion-title>
              <ion-buttons slot="end"><ion-button (click)="newOpen.set(false)">Fechar</ion-button></ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <div class="sheet">
              <ion-list-header><ion-label>Template</ion-label></ion-list-header>
              @for (t of templates; track t.id) {
                <div class="tpl" [class.on]="tpl() === t.id" (click)="pickTemplate(t.id)" (keydown.enter)="pickTemplate(t.id)" tabindex="0" role="radio" [attr.aria-checked]="tpl() === t.id">
                  <div class="tpl-head"><strong>{{ t.name }}</strong> <span class="who">{{ t.who }}</span></div>
                  <p>{{ t.text }}</p>
                  <p class="meta">{{ t.blocks.length }} mesociclos · {{ weeksOf(t.id) }} semanas · objetivo {{ goalLabel[t.goal].toLowerCase() }}</p>
                  @if (tpl() === t.id) { <app-rule-why class="why" [key]="t.rule" /> }
                </div>
              }
              <ion-item>
                <ion-input label="Nome" labelPlacement="stacked" [value]="name()" (ionInput)="name.set($any($event).detail.value ?? '')" />
              </ion-item>
              <ion-item>
                <ion-input label="Começa na semana de" labelPlacement="stacked" type="date" [value]="start()" (ionChange)="start.set($any($event).detail.value ?? start())" />
              </ion-item>
              <ion-list-header><ion-label>Semana-tipo (opcional)</ion-label></ion-list-header>
              <div class="pattern">
                <app-week-pattern [days]="pattern()" [workouts]="workouts.value() ?? []" (changed)="pattern.set($event)" />
                <ion-note class="hint">Que treino fazes em cada dia. Vale para todos os mesociclos e enche os Planeados; podes mudar por mesociclo ou por semana depois. Sem semana-tipo, o ciclo aplica-se a qualquer treino que faças.</ion-note>
              </div>
              <ion-note class="hint">Começa sempre numa segunda-feira; acaba a {{ endLabel() }}. O objetivo do perfil não muda.</ion-note>
              <ion-button expand="block" (click)="create()" [disabled]="!name().trim()">Criar ciclo</ion-button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    .intro { padding: 12px 16px 4px; margin: 0; color: var(--ion-color-medium); font-size: 14px; line-height: 1.5; }
    .now { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); vertical-align: middle; }
    .empty { text-align: center; padding: 32px 16px; color: var(--ion-color-medium); }
    .sheet { padding: 0 12px 24px; max-width: 640px; margin: 0 auto; }
    .tpl { border: 1px solid rgba(128,128,128,.3); border-radius: 12px; padding: 10px 12px; margin: 8px 4px; cursor: pointer; }
    .tpl.on { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), .08); }
    .tpl p { margin: 4px 0 0; font-size: 13px; line-height: 1.4; }
    .tpl-head { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; row-gap: 2px; }
    .tpl .who { font-size: 12px; color: var(--ion-color-medium); }
    .tpl .meta { color: var(--ion-color-medium); font-size: 12px; }
    .tpl .why { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(128,128,128,.2); }
    .hint { display: block; padding: 8px 16px 12px; font-size: 13px; }
    .pattern { padding: 0 8px; }
    .pattern .hint { padding: 6px 4px 0; }
  `,
})
export class CyclesPage implements ViewWillEnter {
  private readonly repo = inject(CYCLE_REPOSITORY);
  private readonly workoutRepo = inject(WORKOUT_REPOSITORY);
  private readonly cycles = inject(CycleService);
  private readonly alerts = inject(AlertController);
  private readonly clock = inject(CLOCK);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastService);
  readonly templates = TEMPLATES;
  readonly goalLabel = GOAL_LABEL;

  readonly list = resource({ loader: () => this.repo.list() });
  readonly rows = computed(() => {
    const today = toLocalDate(this.clock.now());
    return (this.list.value() ?? []).map((c: Cycle) => {
      const pos = positionOn(c, today);
      return {
        c, weeks: totalWeeks(c.plan), when: `${fmtDay(c.startDate)} – ${fmtDay(endDate(c))}`,
        now: pos ? `${pos.block.name}, semana ${pos.weekIndex + 1} de ${pos.block.weeks.length} (semana ${pos.weekNumber} de ${pos.totalWeeks})` : null,
      };
    });
  });

  readonly newOpen = signal(false);
  readonly pattern = signal<(string | null)[] | null>(null);
  readonly workouts = resource({ loader: async () => (await this.workoutRepo.list()).map((w) => ({ id: w.id, name: w.name })) });
  readonly tpl = signal<TemplateId>('simple');
  readonly name = signal('Simples');
  readonly start = signal(weekStartOf(toLocalDate(new Date())));
  readonly endLabel = computed(() => fmtDay(endDate({ startDate: weekStartOf(this.start()), plan: planFrom(this.tpl()) })));

  constructor() {
    addIcons({ add });
  }
  ionViewWillEnter(): void {
    this.list.reload();
  }

  weeksOf = (t: TemplateId) => totalWeeks(planFrom(t));

  openNew(): void {
    this.tpl.set('simple');
    this.name.set('Simples');
    this.start.set(weekStartOf(toLocalDate(this.clock.now())));
    this.pattern.set(null);
    this.workouts.reload();
    this.newOpen.set(true);
  }
  pickTemplate(t: TemplateId): void {
    const old = TEMPLATES.find((x) => x.id === this.tpl())!.name;
    if (!this.name().trim() || this.name() === old) this.name.set(TEMPLATES.find((x) => x.id === t)!.name);
    this.tpl.set(t);
  }

  async create(): Promise<void> {
    try {
      const t = TEMPLATES.find((x) => x.id === this.tpl())!;
      const plan = planFrom(t.id);
      const p = this.pattern();
      if (p?.some(Boolean)) for (const b of plan.blocks) b.pattern = [...p];
      const c = await this.repo.save({ name: this.name(), goal: t.goal, template: t.id, startDate: weekStartOf(this.start()), plan });
      this.newOpen.set(false);
      await askConflicts(this.alerts, this.cycles, await this.cycles.syncSchedule(c.id));
      await this.toasts.success(`Ciclo «${c.name}» criado.`);
      void this.nav.navigateForward(['/ciclos', c.id]);
    } catch (e) {
      await this.toasts.error(e instanceof CycleError ? e.message : 'Não foi possível criar o ciclo.');
    }
  }
}

