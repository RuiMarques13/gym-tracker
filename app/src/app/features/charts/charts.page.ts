import { Component, computed, inject, resource, signal } from '@angular/core';
import { IonContent, IonHeader, IonSelect, IonSelectOption, IonTitle, IonToolbar, ViewWillEnter } from '@ionic/angular';
import { CLOCK } from '../../core/util/clock';
import { addDays, fromLocalDate, toLocalDate, weekStartOf } from '../../core/util/week';
import { BODY_METRIC_REPOSITORY, EXERCISE_REPOSITORY, METRICS_REPOSITORY, SESSION_REPOSITORY } from '../../data/repositories/providers';
import { epley } from '../history/history-format';
import { ChartComponent, ChartPoint } from '../../shared/chart.component';

const WEEKS = 12;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const day = (iso: string) => {
  const d = fromLocalDate(iso.slice(0, 10));
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** Gráficos: séries de força e minutos de mobilidade por semana, peso corporal e progressão por exercício. */
@Component({
  selector: 'app-charts',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonSelect, IonSelectOption, ChartComponent],
  template: `
    <ion-header><ion-toolbar><ion-title>Gráficos</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <section class="card">
          <h2>Séries de força por semana</h2>
          <p class="sub">Séries de trabalho concluídas, últimas {{ weeks }} semanas.</p>
          <app-chart [points]="strengthPoints()" unit=" séries" label="Séries de força por semana" empty="Ainda sem séries de força." />
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

        <section class="card">
          <h2>Mobilidade por semana</h2>
          <p class="sub">Minutos, últimas {{ weeks }} semanas.</p>
          <app-chart [points]="mobilityPoints()" unit=" min" label="Minutos de mobilidade por semana" empty="Ainda sem mobilidade registada." />
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

  private readonly strength = resource({
    params: () => this.refresh(),
    loader: () => this.metrics.weeklyStrengthSets(this.fromWeek(), WEEKS),
  });
  private readonly mobility = resource({
    params: () => this.refresh(),
    loader: () => this.metrics.weeklyMobilityMinutes(this.fromWeek(), WEEKS),
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
  readonly strengthPoints = computed(() => this.nonEmpty(this.weekPoints(this.strength.value() ?? [])));
  readonly mobilityPoints = computed(() => this.nonEmpty(this.weekPoints(this.mobility.value() ?? [])));
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
