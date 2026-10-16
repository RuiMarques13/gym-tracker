import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { chartSeries, HR_ZONES, hrMaxTanaka, timeInZones } from '../../core/health/health.logic';
import { BodyProfileService } from '../../services/health/body-profile.service';
import { HealthService } from '../../services/health/health.service';
import { SESSION_REPOSITORY } from '../../services/repositories';
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
                @if (h.hrRecoveryBpm !== null) { <div><b>−{{ h.hrRecoveryBpm }}</b><span>bpm em 1 min</span></div> }
              </div>
              <app-chart kind="line" [points]="series()" unit=" bpm" label="Frequência cardíaca ao longo do treino"
                empty="Este treino não tem leituras de frequência cardíaca." />
              <p class="sub">Eixo: minutos desde o início do treino. Fonte: {{ h.source ?? 'relógio' }}.</p>
              @if (h.hrRecoveryBpm !== null) {
                <p class="sub">Recuperação: a FC desceu de {{ h.hrEndBpm }} para {{ (h.hrEndBpm ?? 0) - h.hrRecoveryBpm }} bpm no 1.º minuto depois de parares.
                  {{ h.hrRecoveryBpm <= 12 ? 'Uma queda de 12 bpm ou menos é lenta; quanto maior a queda, melhor a forma cardiovascular.' : 'Uma queda acima de 12 bpm é boa.' }}</p>
              }
            } @else if (!health.isLoading()) {
              <p class="sub">Ainda sem dados do relógio para este treino.</p>
            }
            @if (message()) { <p class="msg">{{ message() }}</p> }
            <ion-button size="small" fill="outline" (click)="run()" [disabled]="busy() || !s.endedAt">
              @if (busy()) { <ion-spinner name="dots" /> } @else { {{ health.value() ? 'Atualizar do relógio' : 'Importar do relógio' }} }
            </ion-button>
          </section>

          @if (health.value(); as h) {
            @if (h.caloriesKcal !== null || h.caloriesTotalKcal !== null) {
              <section class="card">
                <h2>Calorias</h2>
                <div class="stats">
                  @if (h.caloriesTotalKcal !== null) { <div><b>{{ h.caloriesTotalKcal }}</b><span>kcal totais</span></div> }
                  @if (h.caloriesKcal !== null) { <div><b>{{ h.caloriesKcal }}</b><span>kcal ativas</span></div> }
                  @if (h.caloriesBasalKcal !== null) { <div><b>{{ h.caloriesBasalKcal }}</b><span>kcal de repouso</span></div> }
                </div>
                <p class="sub">
                  @if (h.caloriesBasis === 'watch-total') {
                    O relógio guarda o gasto total do exercício; as ativas são o total menos o que gastarias em repouso no mesmo tempo.
                  } @else if (h.caloriesBasis === 'watch-active') {
                    Valores guardados pelo relógio no Health Connect.
                  } @else {
                    Sem a taxa de repouso não dá para separar as ativas: preenche o perfil (peso, altura, idade, sexo) nas definições.
                  }
                </p>
              </section>
            }
            @if (zones(); as z) {
              <section class="card">
                <h2>Zonas de frequência cardíaca</h2>
                @for (r of z.rows; track r.id) {
                  <div class="zone">
                    <span class="zl">{{ r.label }} <small>{{ r.range }}</small></span>
                    <span class="bar"><i [style.width.%]="r.pct" [attr.data-z]="r.id"></i></span>
                    <span class="zt">{{ r.time }}</span>
                  </div>
                }
                <p class="sub">Percentagens da FC máxima estimada ({{ z.hrMax }} bpm, fórmula de Tanaka: 208 − 0,7 × idade; erro típico de ±10 bpm).</p>
              </section>
            } @else if (h.samples > 0 && !profileAge()) {
              <p class="sub">Indica a data de nascimento no perfil para veres as zonas de frequência cardíaca.</p>
            }
            @if (h.steps !== null || h.distanceM !== null || h.vo2max !== null || h.exerciseType) {
              <section class="card">
                <h2>Movimento</h2>
                <div class="stats">
                  @if (h.distanceM !== null) { <div><b>{{ km(h.distanceM) }}</b><span>km</span></div> }
                  @if (h.steps !== null) { <div><b>{{ h.steps }}</b><span>passos</span></div> }
                  @if (h.vo2max !== null) { <div><b>{{ h.vo2max }}</b><span>VO₂ máx</span></div> }
                </div>
                @if (h.exerciseType) {
                  <p class="sub">Registado no relógio como «{{ h.exerciseType }}»@if (h.exerciseSeconds) { ({{ minutes(h.exerciseSeconds) }} min) }.</p>
                }
              </section>
            }
          }

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
    .zone { display: grid; grid-template-columns: 112px 1fr 52px; gap: 8px; align-items: center; margin: 6px 0; font-size: 0.85rem; }
    .zl small { display: block; color: var(--ion-color-medium); font-size: 0.7rem; }
    .bar { height: 10px; border-radius: 5px; background: var(--ion-color-light, rgba(128,128,128,.2)); overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: 5px; background: var(--ion-color-medium); }
    .bar i[data-z='3'] { background: var(--ion-color-success); }
    .bar i[data-z='4'] { background: var(--ion-color-warning); }
    .bar i[data-z='5'] { background: var(--ion-color-danger); }
    .zt { text-align: right; font-variant-numeric: tabular-nums; }
  `,
})
export class HealthDetailPage {
  readonly id = input.required<string>();
  private readonly service = inject(HealthService);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly body = inject(BodyProfileService);
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

  readonly profileAge = computed(() => this.body.profile().age);

  /** Tempo em cada zona (precisa da idade para estimar a FC máxima). */
  readonly zones = computed(() => {
    const s = this.session.value();
    const hrMax = hrMaxTanaka(this.body.profile().age);
    const pts = this.points.value() ?? [];
    if (!s || !s.endedAt || !hrMax || !pts.length) return null;
    const secs = timeInZones(pts, hrMax, s.startedAt, s.endedAt);
    const max = Math.max(...secs, 1);
    const fmt = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n} s`);
    return {
      hrMax,
      rows: HR_ZONES.map((z, i) => ({
        id: z.id, label: z.label,
        range: `${Math.round(z.from * hrMax)}–${Math.round((i + 1 < HR_ZONES.length ? HR_ZONES[i + 1].from : 1) * hrMax)} bpm`,
        pct: Math.round((secs[i] / max) * 100), time: fmt(secs[i]),
      })),
    };
  });

  km = (m: number): string => (m / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 2 });
  minutes = (sec: number): number => Math.round(sec / 60);

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
