import { Component, computed, inject, OnInit, resource, signal } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
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
  ModalController,
} from '@ionic/angular';
import { Kind, KIND_LABEL, METRIC_LABEL } from '../../data/models/enums';
import type { Exercise } from '../../data/models/exercise';
import { EXERCISE_REPOSITORY } from '../../data/repositories/providers';

type KindFilter = 'ALL' | Kind;

/**
 * Modal para escolher um ou mais dos teus exercícios.
 * Devolve (dismiss data) a lista de exercícios escolhidos, pela ordem em que foram marcados.
 */
@Component({
  selector: 'app-exercise-picker',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonFooter, IonSearchbar, IonSegment,
    IonSegmentButton, IonLabel, IonList, IonItem, IonCheckbox, IonNote, IonBadge,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-button (click)="close()">Cancelar</ion-button></ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Pesquisar nos teus exercícios" [debounce]="120"
          (ionInput)="query.set($any($event).detail.value ?? '')" />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="kind()" (ionChange)="kind.set($any($event).detail.value)">
          <ion-segment-button value="ALL"><ion-label>Todos</ion-label></ion-segment-button>
          <ion-segment-button value="STRENGTH"><ion-label>Força</ion-label></ion-segment-button>
          <ion-segment-button value="MOBILITY"><ion-label>Mobilidade</ion-label></ion-segment-button>
          <ion-segment-button value="CARDIO"><ion-label>Cardio</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list lines="full">
        @for (e of exercises.value() ?? []; track e.id) {
          <ion-item>
            <ion-checkbox slot="start" [checked]="isSelected(e.id)" (ionChange)="toggle(e)" />
            <ion-label>
              <h2>{{ e.name }}</h2>
              <p>{{ metricLabel[e.metricType] }}{{ e.equipmentName ? ' · ' + e.equipmentName : '' }}</p>
            </ion-label>
            <ion-badge slot="end" color="light">{{ kindLabel[e.kind] }}</ion-badge>
          </ion-item>
        } @empty {
          @if (!exercises.isLoading()) {
            <ion-item lines="none">
              <ion-note class="ion-text-wrap">Nenhum exercício. Adiciona exercícios a partir da biblioteca no ecrã Exercícios.</ion-note>
            </ion-item>
          }
        }
      </ion-list>
    </ion-content>
    <ion-footer>
      <ion-toolbar>
        <div class="footer">
          <ion-button expand="block" [disabled]="!selected().length" (click)="confirm()">
            {{ selected().length ? 'Adicionar ' + selected().length : 'Escolhe exercícios' }}
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    h2 { font-weight: 600; }
    .footer { padding: 4px 12px; }
  `,
})
export class ExercisePickerComponent implements OnInit {
  private readonly repo = inject(EXERCISE_REPOSITORY);
  private readonly modalCtrl = inject(ModalController);

  /** Passados em componentProps (propriedades simples: o ModalController atribui-as diretamente). */
  title = 'Adicionar exercícios';
  initialKind: KindFilter = 'ALL';

  readonly kindLabel = KIND_LABEL;
  readonly metricLabel = METRIC_LABEL;
  readonly query = signal('');
  readonly kind = signal<KindFilter>('ALL');
  readonly selected = signal<Exercise[]>([]);
  private readonly selectedIds = computed(() => new Set(this.selected().map((e) => e.id)));

  readonly exercises = resource({
    params: () => ({ q: this.query(), kind: this.kind() }),
    loader: ({ params }) => this.repo.list({ q: params.q, kind: params.kind === 'ALL' ? undefined : params.kind }),
  });

  ngOnInit(): void {
    this.kind.set(this.initialKind);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggle(e: Exercise): void {
    this.selected.update((list) => (list.some((x) => x.id === e.id) ? list.filter((x) => x.id !== e.id) : [...list, e]));
  }

  close(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm(): void {
    void this.modalCtrl.dismiss(this.selected(), 'confirm');
  }
}
