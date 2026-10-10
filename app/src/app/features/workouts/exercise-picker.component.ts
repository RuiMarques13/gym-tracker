import { Component, computed, inject, OnInit, resource, signal } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { buildGroupLookup, groupOfExercise } from '../../core/library/exercise-group';
import { CATEGORY_LABEL, Kind, METRIC_LABEL } from '../../data/models/enums';
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
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonFooter, IonSearchbar, IonChip,
    IonLabel, IonList, IonItem, IonCheckbox, IonNote, IonBadge,
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
      <div class="chip-row">
        <ion-chip [outline]="group() !== null" (click)="group.set(null)">Todos</ion-chip>
        @for (g of groups(); track g.key) {
          <ion-chip [outline]="group() !== g.key" (click)="group.set(g.key)">{{ g.label }}</ion-chip>
        }
      </div>
    </ion-header>
    <ion-content>
      <ion-list lines="full">
        @for (e of shown(); track e.id) {
          <ion-item>
            <ion-checkbox slot="start" [checked]="isSelected(e.id)" (ionChange)="toggle(e)" />
            <ion-label>
              <h2>{{ e.name }}</h2>
              <p>{{ metricLabel[e.metricType] }}{{ e.equipmentName ? ' · ' + e.equipmentName : '' }}</p>
            </ion-label>
            <ion-badge slot="end" color="light">{{ categoryLabel[e.category] }}</ion-badge>
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
    .chip-row { display: flex; gap: 2px; overflow-x: auto; padding: 0 8px 6px; scrollbar-width: none;
      background: var(--ion-toolbar-background, var(--ion-background-color)); }
    .chip-row::-webkit-scrollbar { display: none; }
    ion-chip { flex: 0 0 auto; }
  `,
})
export class ExercisePickerComponent implements OnInit {
  private readonly repo = inject(EXERCISE_REPOSITORY);
  private readonly modalCtrl = inject(ModalController);

  /** Passados em componentProps (propriedades simples: o ModalController atribui-as diretamente). */
  title = 'Adicionar exercícios';
  initialKind: KindFilter = 'ALL';

  readonly categoryLabel = CATEGORY_LABEL;
  readonly metricLabel = METRIC_LABEL;
  readonly query = signal('');
  readonly selected = signal<Exercise[]>([]);
  private readonly selectedIds = computed(() => new Set(this.selected().map((e) => e.id)));

  readonly exercises = resource({
    params: () => ({ q: this.query() }),
    loader: ({ params }) => this.repo.list({ q: params.q }),
  });

  /** Grupos da biblioteca (os mesmos da lista de exercícios). */
  readonly group = signal<string | null>(null);
  private readonly library = resource({ loader: () => import('../../core/library/library-data').then((m) => m.LIBRARY) });
  readonly groups = computed(() => this.library.value()?.groups ?? []);
  readonly shown = computed(() => {
    const all = this.exercises.value() ?? [];
    const g = this.group();
    const lib = this.library.value();
    if (!g || !lib) return all;
    const lk = buildGroupLookup(lib);
    return all.filter((e) => groupOfExercise(e, lk) === g);
  });

  ngOnInit(): void {
    if (this.initialKind === 'MOBILITY') this.group.set('mobilidade');
    else if (this.initialKind === 'CARDIO') this.group.set('cardio');
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
