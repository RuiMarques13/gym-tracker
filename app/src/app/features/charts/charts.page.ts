import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { IonContent, IonHeader, IonSelect, IonSelectOption, IonTitle, IonToolbar, ViewWillEnter } from '@ionic/angular';
import { CLOCK } from '../../core/util/clock';
import { addDays, fromLocalDate, toLocalDate, weekStartOf } from '../../core/util/week';
import { BODY_METRIC_REPOSITORY, EXERCISE_REPOSITORY, METRICS_REPOSITORY, SESSION_REPOSITORY } from '../../data/repositories/providers';
import { Category, CATEGORIES, CATEGORY_LABEL } from '../../data/models/enums';
import type { CategoryMetric } from '../../data/repositories/metrics.repository';
import { epley } from '../history/history-format';
import { ChartComponent, ChartPoint } from '../../shared/chart.component';

const WEEKS = 12;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const day = (iso: string) => {
  const d = fromLocalDate(iso.slice(0, 10));
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

const METRIC_OPTIONS: Array<{ id: CategoryMetric; label: string; unit: string }> = [
  { id: 'sets', label: 'Séries', unit: ' séries' },
  { id: 'reps', label: 'Repetições', unit: ' reps' },
  { id: 'volumeKg', label: 'Volume (carga × reps)', unit: ' kg' },
  { id: 'minutes', label: 'Tempo', unit: ' min' },
  { id: 'distanceKm', label: 'Distância', unit: ' km' },
];

/** Gráficos: atividade por categoria (séries, reps, carga, tempo, distância), peso corporal e progressão por exercício. */
@Component({
  selector: 'app-charts',
  imports: [NavButtonComponent, IonHeader, IonToolbar, IonTitle, IonContent, IonSelect, IonSelectOption, ChartComponent],
  template: `
    <ion-header><ion-toolbar><app-nav-button slot="start" /><ion-title>Gráficos</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <section class="card">
          <h2>Atividade por categoria</h2>
          <p class="sub">Por semana, últimas {{ weeks }} semanas. Escolhe a categoria e a medida.</p>
          <div class="pair">
            <ion-select label="Categoria" labelPlacement="stacked" interface="popover" [value]="category()"
              (ionChange)="category.set($any($event).detail.value)">
              <ion-select-option [value]="null">Todas</ion-select-option>
              @for (c of categories; track c) {
                <ion-select-option [value]="c">{{ categoryLabel[c] }}</ion-select-option>
              }
            </ion-select>
            <ion-select label="Medida" labelPlacement="stacked" interface="popover" [value]="metric()"
              (ionChange)="metric.set($any($event).detail.value)">
              @for (m of metrics_; track m.id) {
                <ion-select-option [value]="m.id">{{ m.label }}</ion-select-option>
              }
            </ion-select>
          </div>
          <app-chart [points]="categoryPoints()" [unit]="metricInfo().unit" [label]="metricInfo().label + ' por semana'"
            empty="Sem dados desta categoria e medida." />
        </section>

        <section class="card">
          <h2>Progressão por exercício</h2>
          <p class="sub">Melhor 1RM estimado (Epley) em cada sessão.</p>
          <ion-select label="Exercício" labelPlacement="stacked" interface="popover" placeholder="Escolhe um exercício"
            [value]="exerciseId()" (ionChange)="exerciseId.set($any($event).detail.value)">
            @for (e of exercises.value() ?? []; track e.id) {
              <ion-select-option [value]="e.id">{{ e.name }}</ion-select-option>
            }
          </ion-select>
          <app-chart kind="line" [points]="progressPoints()" unit=" kg" label="Progressão do 1RM estimado"
            [empty]="exerciseId() ? 'Sem séries com carga neste exercício.' : 'Escolhe um exercício para ver a evolução.'" />
        </section>

        <section class="card">
          <h2>Peso corporal</h2>
          <p class="sub">As tuas medições, da mais antiga à mais recente.</p>
          <app-chart kind="line" [points]="weightPoints()" unit=" kg" label="Peso corporal" empty="Ainda sem medições de peso. Regista no Perfil." />
        </section>

      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; padding: 8px 16px 32px; display: grid; gap: 16px; }
    .card { background: var(--ion-card-background, var(--ion-item-background)); border-radius: 14px; padding: 16px; }
    h2 { margin: 0 0 2px; font-size: 1.05rem; }
    .sub { margin: 0 0 8px; color: var(--ion-color-medium); font-size: 0.85rem; }
    ion-select { margin-bottom: 8px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `,
})
export class ChartsPage implements ViewWillEnter {
  private readonly clock = inject(CLOCK);
  private readonly metrics = inject(METRICS_REPOSITORY);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly body = inject(BODY_METRIC_REPOSITORY);
  private readonly exerciseRepo = inject(EXERCISE_REPOSITORY);

  readonly weeks = WEEKS;
  readonly exerciseId = signal<string | null>(null);
  private readonly refresh = signal(0);

  private fromWeek() {
    return addDays(weekStartOf(toLocalDate(this.clock.now())), -(WEEKS - 1) * 7);
  }
  private weekPoints = (rows: Array<{ weekStart: string; value: number }>): ChartPoint[] =>
    rows.map((r) => ({ label: day(r.weekStart), full: `Semana de ${day(r.weekStart)}`, value: r.value }));

  readonly categories = CATEGORIES;
  readonly categoryLabel = CATEGORY_LABEL;
  readonly metrics_ = METRIC_OPTIONS;
  readonly category = signal<Category | null>(null);
  readonly metric = signal<CategoryMetric>('sets');
  readonly metricInfo = computed(() => METRIC_OPTIONS.find((m) => m.id === this.metric())!);
  private readonly byCategory = resource({
    params: () => ({ n: this.refresh(), c: this.category(), m: this.metric() }),
    loader: ({ params }) => this.metrics.weeklyCategory(this.fromWeek(), WEEKS, params.c, params.m),
  });
  private readonly weight = resource({
    params: () => this.refresh(),
    loader: () => this.body.list('WEIGHT_KG', 90),
  });
  readonly exercises = resource({
    params: () => this.refresh(),
    loader: () => this.exerciseRepo.list({ kind: 'STRENGTH' }),
  });
  private readonly history = resource({
    params: () => ({ id: this.exerciseId(), n: this.refresh() }),
    loader: ({ params }) => (params.id ? this.sessions.exerciseHistory(params.id, { limit: 40 }) : Promise.resolve([])),
  });

  /** Com menos de duas semanas de dados, o gráfico de barras não diz nada: mostra a mensagem. */
  readonly categoryPoints = computed(() => this.nonEmpty(this.weekPoints(this.byCategory.value() ?? [])));
  private nonEmpty(p: ChartPoint[]): ChartPoint[] {
    return p.some((x) => x.value > 0) ? p : [];
  }

  readonly weightPoints = computed<ChartPoint[]>(() =>
    [...(this.weight.value() ?? [])].reverse().map((m) => ({ label: day(m.date), full: day(m.date), value: m.value })),
  );

  readonly progressPoints = computed<ChartPoint[]>(() =>
    (this.history.value() ?? [])
      .map((h) => ({ at: h.startedAt, best: Math.max(0, ...h.sets.map((s) => epley(s) ?? 0)) }))
      .filter((h) => h.best > 0)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((h) => ({ label: day(h.at), full: `Sessão de ${day(h.at)}`, value: h.best })),
  );

  ionViewWillEnter(): void {
    this.refresh.update((n) => n + 1);
  }
}
