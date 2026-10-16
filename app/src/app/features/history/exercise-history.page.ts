import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonSegment, IonSegmentButton, IonTitle, IonToolbar,
} from '@ionic/angular';
import { groupSets } from '../../data/models/session';
import { EXERCISE_REPOSITORY, SESSION_REPOSITORY } from '../../services/repositories';
import { formatSetGroup } from '../session/session-format';
import { ChartComponent, ChartPoint } from '../../shared/chart.component';
import { epley, formatDay, progressSeries } from './history-format';

type Metric = 'e1rm' | 'volume' | 'topWeight';
const METRICS: Record<Metric, { unit: string; label: string }> = {
  e1rm: { unit: ' kg', label: '1RM estimado' },
  volume: { unit: ' kg', label: 'Volume-carga' },
  topWeight: { unit: ' kg', label: 'Carga máxima' },
};

/** O que fizeste num exercício, sessão a sessão. Toca numa sessão para a corrigir. */
@Component({
  selector: 'app-exercise-history',
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonItem, IonLabel, IonNote, IonSegment, IonSegmentButton, ChartComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button [defaultHref]="'/exercicios/' + id()" text="" /></ion-buttons>
        <ion-title>{{ exercise.value()?.name ?? 'Histórico' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        @if (!entries.isLoading() && !entries.value()?.length) {
          <p class="empty">Ainda não fizeste este exercício numa sessão terminada.</p>
        } @else {
          @if (best(); as b) {
            <div class="best">
              <span class="value">{{ b }} kg</span>
              <span class="label">melhor 1RM estimado (Epley)</span>
            </div>
          }
          @if (points().length > 1) {
            <section class="chart">
              <ion-segment [value]="metric()" (ionChange)="metric.set($any($event).detail.value)">
                <ion-segment-button value="e1rm"><ion-label>1RM est.</ion-label></ion-segment-button>
                <ion-segment-button value="volume"><ion-label>Volume</ion-label></ion-segment-button>
                <ion-segment-button value="topWeight"><ion-label>Carga máx.</ion-label></ion-segment-button>
              </ion-segment>
              <app-chart kind="line" [points]="points()" [unit]="unit()" [label]="label()" empty="Sem séries com carga." />
            </section>
          }
          <ion-list lines="full">
            @for (h of entries.value() ?? []; track h.sessionExerciseId) {
              <ion-item [routerLink]="['/historico', h.sessionId]" [detail]="true">
                <ion-label class="ion-text-wrap">
                  <h3>{{ day(h.startedAt) }} <ion-note>{{ h.templateName ?? 'Sessão livre' }}</ion-note></h3>
                  @for (g of groups(h.sets); track g.position) {
                    <p>{{ g.position }} · {{ format(h, g) }}{{ g.type === 'WARMUP' ? ' (aquecimento)' : '' }}</p>
                  }
                </ion-label>
              </ion-item>
            }
          </ion-list>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    .empty { text-align: center; color: var(--ion-color-medium); margin: 20vh 16px 0; }
    .best { padding: 16px; display: flex; flex-direction: column; }
    .best .value { font-size: 1.8rem; font-weight: 700; color: var(--ion-color-primary); }
    .best .label { color: var(--ion-color-medium); font-size: 0.85rem; }
    .chart { padding: 0 16px 8px; }
    .chart ion-segment { margin-bottom: 8px; }
    h3 { font-weight: 600; }
  `,
})
export class ExerciseHistoryPage {
  readonly id = input.required<string>();
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly exercises = inject(EXERCISE_REPOSITORY);

  readonly exercise = resource({ params: () => this.id(), loader: ({ params }) => this.exercises.get(params) });
  readonly entries = resource({ params: () => this.id(), loader: ({ params }) => this.sessions.exerciseHistory(params) });
  readonly best = computed(() => {
    let max = 0;
    for (const h of this.entries.value() ?? []) for (const s of h.sets) max = Math.max(max, epley(s) ?? 0);
    return max || null;
  });

  readonly metric = signal<Metric>('e1rm');
  readonly unit = computed(() => METRICS[this.metric()].unit);
  readonly label = computed(() => METRICS[this.metric()].label);
  readonly points = computed<ChartPoint[]>(() => {
    const m = this.metric();
    return progressSeries(this.entries.value() ?? []).map((p) => ({
      label: formatDay(p.at).replace(/^\S+,?\s/, ''), full: `Sessão de ${formatDay(p.at)}`, value: p[m],
    }));
  });

  day = formatDay;
  groups = groupSets;
  format = formatSetGroup;
}
