import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonTitle, IonToolbar,
} from '@ionic/angular';
import { groupSets } from '../../data/models/session';
import { EXERCISE_REPOSITORY, SESSION_REPOSITORY } from '../../data/repositories/providers';
import { formatSetGroup } from '../session/session-format';
import { epley, formatDay } from './history-format';

/** O que fizeste num exercício, sessão a sessão. Toca numa sessão para a corrigir. */
@Component({
  selector: 'app-exercise-history',
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonItem, IonLabel, IonNote],
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

  day = formatDay;
  groups = groupSets;
  format = formatSetGroup;
}
