import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { chartSeries } from '../../core/health/health.logic';
import { HealthService } from '../../core/health/health.service';
import { SESSION_REPOSITORY } from '../../data/repositories/providers';
import { ChartComponent, ChartPoint } from '../../shared/chart.component';
import { effortLabel } from '../../shared/effort-scale';
import { formatDay, formatSpan, formatTime, formatVolume } from '../history/history-format';
import { groupSets } from '../../data/models/session';

/** Um treino com os dados do relógio: frequência cardíaca ao longo do tempo, calorias e totais. */
@Component({
  selector: 'app-health-detail',
  imports: [RouterLink, ChartComponent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonButton, IonSpinner],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/saude" text="" /></ion-buttons>
        <ion-title>{{ session.value()?.templateName ?? 'Treino' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        @if (session.value(); as s) {
          <p class="when">{{ day(s.startedAt) }} · {{ time(s.startedAt) }}@if (s.endedAt) { · {{ span(s.startedAt, s.endedAt) }} }</p>

          <section class="card">
            <h2>Frequência cardíaca</h2>
            @if (health.value(); as h) {
              <div class="stats">
                @if (h.avg !== null) { <div><b>{{ h.avg }}</b><span>bpm médio</span></div> }
                @if (h.max !== null) { <div><b>{{ h.max }}</b><span>máximo</span></div> }
                @if (h.min !== null) { <div><b>{{ h.min }}</b><span>mínimo</span></div> }
                @if (h.caloriesKcal !== null) { <div><b>{{ h.caloriesKcal }}</b><span>kcal ativas</span></div> }
              </div>
              <app-chart kind="line" [points]="series()" unit=" bpm" label="Frequência cardíaca ao longo do treino"
                empty="Este treino não tem leituras de frequência cardíaca." />
              <p class="sub">Eixo: minutos desde o início do treino. Fonte: {{ h.source ?? 'relógio' }}.</p>
            } @else if (!health.isLoading()) {
              <p class="sub">Ainda sem dados do relógio para este treino.</p>
            }
            @if (message()) { <p class="msg">{{ message() }}</p> }
            <ion-button size="small" fill="outline" (click)="run()" [disabled]="busy() || !s.endedAt">
              @if (busy()) { <ion-spinner name="dots" /> } @else { {{ health.value() ? 'Atualizar do relógio' : 'Importar do relógio' }} }
            </ion-button>
          </section>

          <section class="card">
            <h2>O treino</h2>
            <div class="stats">
              <div><b>{{ totals().exercises }}</b><span>exercícios</span></div>
              <div><b>{{ totals().sets }}</b><span>séries</span></div>
              @if (totals().volume) { <div><b>{{ volume(totals().volume) }}</b><span>volume</span></div> }
              @if (s.rpe !== null) { <div><b>{{ s.rpe }}</b><span>esforço{{ effortName(s.rpe) }}</span></div> }
            </div>
            <a [routerLink]="['/historico', s.id]">Ver séries e cargas</a>
          </section>
        } @else {
          <div class="center"><ion-spinner /></div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; padding: 8px 16px 32px; display: grid; gap: 16px; }
    .center { display: grid; place-items: center; padding: 20vh 0; }
    .when { margin: 0; color: var(--ion-color-medium); }
    .card { background: var(--ion-card-background, var(--ion-item-background)); border-radius: 14px; padding: 16px; }
    h2 { margin: 0 0 8px; font-size: 1.05rem; }
    .stats { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 8px; }
    .stats div { display: flex; flex-direction: column; }
    .stats b { font-size: 1.4rem; }
    .stats span, .sub { font-size: 0.8rem; color: var(--ion-color-medium); }
    .sub { margin: 6px 0; }
    .msg { font-size: 0.85rem; margin: 6px 0; }
    a { font-size: 0.9rem; }
  `,
})
export class HealthDetailPage {
  readonly id = input.required<string>();
  private readonly service = inject(HealthService);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly refresh = signal(0);

  readonly busy = signal(false);
  readonly message = signal<string | null>(null);

  readonly session = resource({ params: () => this.id(), loader: ({ params }) => this.sessions.get(params) });
  readonly health = resource({ params: () => ({ id: this.id(), n: this.refresh() }), loader: ({ params }) => this.service.summary(params.id) });
  private readonly points = resource({ params: () => ({ id: this.id(), n: this.refresh() }), loader: ({ params }) => this.service.points(params.id) });

  readonly series = computed<ChartPoint[]>(() => {
    const s = this.session.value();
    if (!s) return [];
    return chartSeries(this.points.value() ?? [], s.startedAt).map((p) => ({
      label: `${p.minute}′`, full: `Minuto ${p.minute}`, value: p.bpm,
    }));
  });

  readonly totals = computed(() => {
    const ex = this.session.value()?.exercises ?? [];
    let volume = 0;
    for (const e of ex) for (const x of e.sets) if (x.type === 'WORKING' && x.weightKg && x.reps) volume += x.weightKg * x.reps;
    return { exercises: ex.length, sets: ex.reduce((n, e) => n + groupSets(e.sets).length, 0), volume: Math.round(volume) };
  });

  day = formatDay;
  time = formatTime;
  span = formatSpan;
  volume = formatVolume;
  effortName = (v: number): string => {
    const l = effortLabel(v);
    return l ? ` · ${l.toLowerCase()}` : '';
  };

  async run(): Promise<void> {
    const s = this.session.value();
    if (!s) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const r = await this.service.importForSession({ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt });
      if (!r.ok) this.message.set(r.reason);
      this.refresh.update((n) => n + 1);
    } catch (err) {
      this.message.set(err instanceof Error ? err.message : 'Não foi possível importar.');
    } finally {
      this.busy.set(false);
    }
  }
}
