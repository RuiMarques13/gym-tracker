import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import {
  IonBadge,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { Kind, METRIC_LABEL, REGION_LABEL } from '../../data/models/enums';
import { Exercise } from '../../data/models/exercise';
import { EXERCISE_REPOSITORY } from '../../data/repositories/providers';

type KindFilter = 'ALL' | Kind;

/**
 * Fase 0: catálogo só de leitura, para confirmar o seed.
 * Fase 1.1 acrescenta filtros completos, formulário, arquivar e restaurar.
 */
@Component({
  selector: 'app-exercises',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonSegment, IonSegmentButton,
    IonList, IonItem, IonLabel, IonNote, IonBadge,
  ],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>Exercícios</ion-title></ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          placeholder="Pesquisar por nome"
          [debounce]="150"
          (ionInput)="query.set($any($event).detail.value ?? '')"
        />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="kindFilter()" (ionChange)="kindFilter.set($any($event).detail.value)">
          <ion-segment-button value="ALL"><ion-label>Todos</ion-label></ion-segment-button>
          <ion-segment-button value="STRENGTH"><ion-label>Força</ion-label></ion-segment-button>
          <ion-segment-button value="MOBILITY"><ion-label>Mobilidade</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <p class="count">{{ countLabel() }}</p>
        <ion-list lines="full">
          @for (e of exercises.value() ?? []; track e.id) {
            <ion-item>
              <ion-label>
                <h2>{{ e.name }}</h2>
                <p>{{ subtitle(e) }}</p>
              </ion-label>
              <div slot="end" class="badges">
                @if (e.isUnilateral) { <ion-badge color="tertiary">Unilateral</ion-badge> }
                <ion-badge [color]="e.kind === 'MOBILITY' ? 'success' : 'primary'">
                  {{ e.kind === 'MOBILITY' ? 'Mobilidade' : 'Força' }}
                </ion-badge>
              </div>
            </ion-item>
          } @empty {
            @if (!exercises.isLoading()) {
              <ion-item lines="none"><ion-note>Nenhum exercício encontrado.</ion-note></ion-item>
            }
          }
        </ion-list>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 860px; margin: 0 auto; }
    .count { margin: 12px 16px 4px; font-size: 0.85rem; color: var(--ion-color-medium); }
    .badges { display: flex; gap: 6px; }
    ion-badge { font-weight: 500; }
    h2 { font-weight: 600; }
  `,
})
export class ExercisesPage {
  private readonly repo = inject(EXERCISE_REPOSITORY);

  /** ?kind=STRENGTH|MOBILITY vindo da Home. */
  readonly kind = input<string | undefined>();
  readonly kindFilter = linkedSignal<KindFilter>(() =>
    this.kind() === 'STRENGTH' || this.kind() === 'MOBILITY' ? (this.kind() as Kind) : 'ALL',
  );
  readonly query = signal('');

  readonly exercises = resource({
    params: () => ({ q: this.query(), kind: this.kindFilter() }),
    loader: ({ params }) =>
      this.repo.list({ q: params.q, kind: params.kind === 'ALL' ? undefined : params.kind }),
  });

  readonly countLabel = computed(() => {
    const n = this.exercises.value()?.length ?? 0;
    return n === 1 ? '1 exercício' : `${n} exercícios`;
  });

  subtitle(e: Exercise): string {
    const parts = [
      e.region ? REGION_LABEL[e.region] : null,
      e.movementType === 'PUSH' ? 'Push' : e.movementType === 'PULL' ? 'Pull' : null,
      METRIC_LABEL[e.metricType],
      e.equipmentName,
    ];
    return parts.filter(Boolean).join(' · ');
  }
}
