import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, checkmark, refreshOutline } from 'ionicons/icons';
import { libraryItemToInput, LibraryItemState } from '../../core/library/library';
import type { LibraryItem } from '../../core/library/library-types';
import { SEED } from '../../core/seed/seed.generated';
import { ids } from '../../core/util/uuid';
import { METRIC_LABEL } from '../../data/models/enums';
import { ExerciseValidationError } from '../../data/models/exercise';
import { EXERCISE_REPOSITORY } from '../../data/repositories/providers';
import { fold } from '../../data/repositories/sqlite/sqlite-exercise.repository';

const MUSCLE_NAME = new Map(SEED.muscles.map((m) => [m.key, m.name]));
const EQUIPMENT_NAME = new Map(SEED.equipment.map((e) => [e.key, e.name]));
const AREA_NAME = new Map(SEED.mobilityAreas.map((a) => [a.key, a.name]));
const PAGE = 60;

/**
 * Biblioteca de exercícios (só consulta). Tocar em «Adicionar» copia o item
 * para os teus exercícios, onde o podes editar como quiseres.
 */
@Component({
  selector: 'app-library',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonSearchbar, IonChip, IonLabel,
    IonList, IonItem, IonNote, IonBadge, IonButton, IonIcon, IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/exercicios" text="" /></ion-buttons>
        <ion-title>Biblioteca</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Pesquisar na biblioteca" [debounce]="150"
          (ionInput)="query.set($any($event).detail.value ?? ''); limit.set(PAGE)" />
      </ion-toolbar>
      <div class="filters">
        <div class="chip-row">
          <ion-chip [outline]="group() !== null" (click)="group.set(null); limit.set(PAGE)">Todos</ion-chip>
          @for (g of groups(); track g.key) {
            <ion-chip [outline]="group() !== g.key" (click)="group.set(g.key); limit.set(PAGE)">{{ g.label }}</ion-chip>
          }
        </div>
        <div class="chip-row">
          <ion-chip class="small" [outline]="equipment() !== null" (click)="equipment.set(null); limit.set(PAGE)">Qualquer equipamento</ion-chip>
          @for (e of equipmentList; track e.key) {
            <ion-chip class="small" [outline]="equipment() !== e.key" (click)="equipment.set(e.key); limit.set(PAGE)">{{ e.name }}</ion-chip>
          }
        </div>
      </div>
    </ion-header>

    <ion-content>
      <div class="page">
        @if (library.isLoading()) {
          <div class="loading"><ion-spinner /></div>
        } @else {
          <p class="count">{{ countLabel() }}</p>
          <ion-list lines="full">
            @for (item of visible(); track item.key) {
              <ion-item>
                <ion-label class="ion-text-wrap">
                  <h2>{{ item.name }}</h2>
                  <p>{{ subtitle(item) }}</p>
                </ion-label>
                <div slot="end" class="end">
                  @if (item.isUnilateral) { <ion-badge color="tertiary">Unilateral</ion-badge> }
                  @switch (state(item)) {
                    @case ('added') {
                      <ion-button size="small" fill="clear" disabled>
                        <ion-icon slot="start" name="checkmark" /> Adicionado
                      </ion-button>
                    }
                    @case ('archived') {
                      <ion-button size="small" fill="outline" (click)="add(item)" [disabled]="busy() === item.key">
                        <ion-icon slot="start" name="refresh-outline" /> Restaurar
                      </ion-button>
                    }
                    @default {
                      <ion-button size="small" fill="outline" (click)="add(item)" [disabled]="busy() === item.key">
                        <ion-icon slot="start" name="add" /> Adicionar
                      </ion-button>
                    }
                  }
                </div>
              </ion-item>
            } @empty {
              <ion-item lines="none"><ion-note>Nada encontrado com estes filtros.</ion-note></ion-item>
            }
          </ion-list>
          @if (filtered().length > visible().length) {
            <div class="more">
              <ion-button fill="clear" (click)="limit.set(limit() + PAGE)">
                Mostrar mais ({{ filtered().length - visible().length }})
              </ion-button>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 860px; margin: 0 auto; }
    .filters { background: var(--ion-toolbar-background, var(--ion-background-color)); padding: 0 0 6px; }
    .chip-row { display: flex; gap: 2px; overflow-x: auto; padding: 0 8px; scrollbar-width: none; }
    .chip-row::-webkit-scrollbar { display: none; }
    ion-chip { flex: 0 0 auto; }
    ion-chip.small { height: 28px; font-size: 0.8rem; }
    .count { margin: 12px 16px 4px; font-size: 0.85rem; color: var(--ion-color-medium); }
    .end { display: flex; align-items: center; gap: 6px; }
    h2 { font-weight: 600; }
    .loading, .more { display: flex; justify-content: center; padding: 24px; }
  `,
})
export class LibraryPage implements ViewWillEnter {
  private readonly repo = inject(EXERCISE_REPOSITORY);
  private readonly toasts = inject(ToastController);
  readonly PAGE = PAGE;

  readonly query = signal('');
  readonly group = signal<string | null>(null);
  readonly equipment = signal<string | null>(null);
  readonly limit = signal(PAGE);
  readonly busy = signal<string | null>(null);
  readonly equipmentList = SEED.equipment;

  /** Carregada à parte (chunk próprio) para não pesar no arranque. */
  readonly library = resource({
    loader: () => import('../../core/library/library-data').then((m) => m.LIBRARY),
  });

  /** Estado de cada exercício teu (inclui arquivados) para mostrar «Adicionado»/«Restaurar». */
  readonly mine = resource({
    loader: async () => {
      const all = await this.repo.list({ includeArchived: true });
      return new Map(all.map((e) => [e.id, e.archivedAt ? 'archived' : 'added'] as const));
    },
  });

  readonly groups = computed(() => this.library.value()?.groups ?? []);
  private readonly groupLabel = computed(() => new Map(this.groups().map((g) => [g.key, g.label])));

  readonly filtered = computed(() => {
    const items = this.library.value()?.items ?? [];
    const q = fold(this.query().trim());
    const g = this.group();
    const eq = this.equipment();
    return items.filter(
      (i) => (!g || i.group === g) && (!eq || i.equipment === eq) && (!q || fold(i.name).includes(q)),
    );
  });
  readonly visible = computed(() => this.filtered().slice(0, this.limit()));
  readonly countLabel = computed(() => {
    const n = this.filtered().length;
    return n === 1 ? '1 exercício' : `${n} exercícios`;
  });

  constructor() {
    addIcons({ add, checkmark, refreshOutline });
  }

  ionViewWillEnter(): void {
    this.mine.reload();
  }

  state(item: LibraryItem): LibraryItemState {
    return this.mine.value()?.get(ids.libraryExercise(item.key)) ?? 'available';
  }

  subtitle(item: LibraryItem): string {
    const muscles = [
      ...[...item.primary, ...item.secondary].map((k) => MUSCLE_NAME.get(k)),
      ...item.mobilityAreas.map((k) => AREA_NAME.get(k)),
    ].filter(Boolean);
    return [
      item.equipment ? EQUIPMENT_NAME.get(item.equipment) : null,
      muscles.length ? muscles.join(', ') : this.groupLabel().get(item.group),
      METRIC_LABEL[item.metricType],
    ]
      .filter(Boolean)
      .join(' · ');
  }

  async add(item: LibraryItem): Promise<void> {
    this.busy.set(item.key);
    try {
      const ex = await this.repo.save(libraryItemToInput(item));
      this.mine.value()?.set(ex.id, 'added');
      this.mine.set(new Map(this.mine.value()));
      await this.toast(`«${ex.name}» está nos teus exercícios.`, 'success');
    } catch (err) {
      const msg = err instanceof ExerciseValidationError ? err.message : 'Não foi possível adicionar.';
      await this.toast(msg, 'danger');
    } finally {
      this.busy.set(null);
    }
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toasts.create({ message, color, duration: 2200, position: 'bottom' });
    await t.present();
  }
}
