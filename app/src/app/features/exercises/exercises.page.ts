import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, libraryOutline, optionsOutline } from 'ionicons/icons';
import {
  Kind,
  KIND_LABEL,
  METRIC_LABEL,
  MOVEMENT_LABEL,
  MovementType,
  Region,
  REGION_LABEL,
} from '../../data/models/enums';
import { Exercise, ExerciseFilter } from '../../data/models/exercise';
import { EXERCISE_REPOSITORY, LOOKUP_REPOSITORY } from '../../data/repositories/providers';

type KindFilter = 'ALL' | Kind;
type TriState = 'any' | 'yes' | 'no';

const KIND_COLOR: Record<Kind, string> = { STRENGTH: 'primary', MOBILITY: 'success', CARDIO: 'warning' };

/** Os teus exercícios: pesquisa, filtros, ordenação; tocar abre o formulário. */
@Component({
  selector: 'app-exercises',
  imports: [NavButtonComponent, 
    RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonSearchbar,
    IonSegment, IonSegmentButton, IonList, IonListHeader, IonItem, IonLabel, IonNote, IonBadge, IonModal,
    IonSelect, IonSelectOption, IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <app-nav-button slot="start" />
        <ion-title>Exercícios</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/exercicios/biblioteca">
            <ion-icon slot="start" name="library-outline" /> Biblioteca
          </ion-button>
          <ion-button routerLink="/exercicios/novo" aria-label="Novo exercício">
            <ion-icon slot="icon-only" name="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Pesquisar por nome" [debounce]="150"
          (ionInput)="query.set($any($event).detail.value ?? '')" />
        <ion-buttons slot="end">
          <ion-button (click)="filtersOpen.set(true)" aria-label="Filtros e ordenação">
            <ion-icon slot="icon-only" name="options-outline" />
            @if (activeFilters() > 0) { <ion-badge class="count-badge">{{ activeFilters() }}</ion-badge> }
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="kindFilter()" (ionChange)="kindFilter.set($any($event).detail.value)" [scrollable]="true">
          <ion-segment-button value="ALL"><ion-label>Todos</ion-label></ion-segment-button>
          <ion-segment-button value="STRENGTH"><ion-label>Força</ion-label></ion-segment-button>
          <ion-segment-button value="MOBILITY"><ion-label>Mobilidade</ion-label></ion-segment-button>
          <ion-segment-button value="CARDIO"><ion-label>Cardio</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <p class="count">
          {{ countLabel() }}
          @if (activeFilters() > 0) { · <a (click)="clearFilters()">limpar filtros</a> }
        </p>
        <ion-list lines="full">
          @for (e of exercises.value() ?? []; track e.id) {
            <ion-item [routerLink]="['/exercicios', e.id]" [detail]="false" button>
              <ion-label>
                <h2>{{ e.name }}</h2>
                <p>{{ subtitle(e) }}</p>
              </ion-label>
              <div slot="end" class="badges">
                @if (e.archivedAt) { <ion-badge color="medium">Arquivado</ion-badge> }
                @if (e.isUnilateral) { <ion-badge color="tertiary">Unilateral</ion-badge> }
                <ion-badge [color]="kindColor[e.kind]">{{ kindLabel[e.kind] }}</ion-badge>
              </div>
            </ion-item>
          } @empty {
            @if (!exercises.isLoading()) {
              <ion-item lines="none">
                <ion-note class="ion-text-wrap">
                  Nenhum exercício encontrado. Procura na <a routerLink="/exercicios/biblioteca">biblioteca</a>
                  ou <a routerLink="/exercicios/novo">cria um novo</a>.
                </ion-note>
              </ion-item>
            }
          }
        </ion-list>
      </div>

      <ion-modal [isOpen]="filtersOpen()" (didDismiss)="filtersOpen.set(false)" [initialBreakpoint]="0.85" [breakpoints]="[0, 0.85, 1]">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>Filtros</ion-title>
              <ion-buttons slot="start"><ion-button (click)="clearFilters()">Limpar</ion-button></ion-buttons>
              <ion-buttons slot="end"><ion-button (click)="filtersOpen.set(false)"><strong>Ver</strong></ion-button></ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-list lines="full">
              <ion-list-header><ion-label>Ordenar</ion-label></ion-list-header>
              <ion-item lines="none">
                <ion-segment [value]="sort()" (ionChange)="sort.set($any($event).detail.value)">
                  <ion-segment-button value="name"><ion-label>Nome (A→Z)</ion-label></ion-segment-button>
                  <ion-segment-button value="recent"><ion-label>Recentes</ion-label></ion-segment-button>
                </ion-segment>
              </ion-item>

              <ion-list-header><ion-label>Filtrar</ion-label></ion-list-header>
              <ion-item>
                <ion-select label="Grupo muscular" [multiple]="true" placeholder="Todos" [value]="muscleIds()"
                  (ionChange)="muscleIds.set($any($event).detail.value ?? [])" cancelText="Cancelar" okText="OK">
                  @for (m of lookups.value()?.muscles ?? []; track m.id) {
                    <ion-select-option [value]="m.id">{{ m.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Equipamento" [multiple]="true" placeholder="Todos" [value]="equipmentIds()"
                  (ionChange)="equipmentIds.set($any($event).detail.value ?? [])" cancelText="Cancelar" okText="OK">
                  @for (e of lookups.value()?.equipment ?? []; track e.id) {
                    <ion-select-option [value]="e.id">{{ e.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Área de mobilidade" [multiple]="true" placeholder="Todas" [value]="areaIds()"
                  (ionChange)="areaIds.set($any($event).detail.value ?? [])" cancelText="Cancelar" okText="OK">
                  @for (a of lookups.value()?.areas ?? []; track a.id) {
                    <ion-select-option [value]="a.id">{{ a.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Região" interface="popover" [value]="region()" (ionChange)="region.set($any($event).detail.value)">
                  <ion-select-option [value]="null">Todas</ion-select-option>
                  @for (r of regions; track r) { <ion-select-option [value]="r">{{ regionLabel[r] }}</ion-select-option> }
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Push / Pull" interface="popover" [value]="movement()" (ionChange)="movement.set($any($event).detail.value)">
                  <ion-select-option [value]="null">Todos</ion-select-option>
                  <ion-select-option value="PUSH">Push</ion-select-option>
                  <ion-select-option value="PULL">Pull</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Isométrico" interface="popover" [value]="isometric()" (ionChange)="isometric.set($any($event).detail.value)">
                  <ion-select-option value="any">Indiferente</ion-select-option>
                  <ion-select-option value="yes">Só isométricos</ion-select-option>
                  <ion-select-option value="no">Sem isométricos</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Unilateral" interface="popover" [value]="unilateral()" (ionChange)="unilateral.set($any($event).detail.value)">
                  <ion-select-option value="any">Indiferente</ion-select-option>
                  <ion-select-option value="yes">Só unilaterais</ion-select-option>
                  <ion-select-option value="no">Sem unilaterais</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-toggle [checked]="includeArchived()" (ionChange)="includeArchived.set($any($event).detail.checked)">
                  Mostrar arquivados
                </ion-toggle>
              </ion-item>
            </ion-list>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    .page { max-width: 860px; margin: 0 auto; }
    .count { margin: 12px 16px 4px; font-size: 0.85rem; color: var(--ion-color-medium); }
    .count a { cursor: pointer; color: var(--ion-color-primary); }
    .badges { display: flex; gap: 6px; }
    ion-badge { font-weight: 500; }
    h2 { font-weight: 600; }
    .count-badge { position: absolute; top: 2px; right: 0; font-size: 0.65rem; padding: 3px 5px; }
  `,
})
export class ExercisesPage implements ViewWillEnter {
  private readonly repo = inject(EXERCISE_REPOSITORY);
  private readonly lookupRepo = inject(LOOKUP_REPOSITORY);

  readonly kindLabel = KIND_LABEL;
  readonly kindColor = KIND_COLOR;
  readonly regionLabel = REGION_LABEL;
  readonly regions: Region[] = ['UPPER', 'LOWER', 'CORE', 'FULL_BODY'];

  /** ?kind=STRENGTH|MOBILITY|CARDIO vindo da Home. */
  readonly kind = input<string | undefined>();
  readonly kindFilter = linkedSignal<KindFilter>(() => {
    const k = this.kind();
    return k === 'STRENGTH' || k === 'MOBILITY' || k === 'CARDIO' ? k : 'ALL';
  });
  readonly query = signal('');
  readonly filtersOpen = signal(false);
  readonly sort = signal<'name' | 'recent'>('name');
  readonly muscleIds = signal<string[]>([]);
  readonly equipmentIds = signal<string[]>([]);
  readonly areaIds = signal<string[]>([]);
  readonly region = signal<Region | null>(null);
  readonly movement = signal<MovementType | null>(null);
  readonly isometric = signal<TriState>('any');
  readonly unilateral = signal<TriState>('any');
  readonly includeArchived = signal(false);

  readonly activeFilters = computed(
    () =>
      [this.muscleIds().length, this.equipmentIds().length, this.areaIds().length, this.region(), this.movement()]
        .filter(Boolean).length +
      (this.isometric() !== 'any' ? 1 : 0) +
      (this.unilateral() !== 'any' ? 1 : 0) +
      (this.includeArchived() ? 1 : 0),
  );

  private readonly filter = computed<ExerciseFilter>(() => ({
    q: this.query(),
    kind: this.kindFilter() === 'ALL' ? undefined : (this.kindFilter() as Kind),
    muscleGroupIds: this.muscleIds(),
    equipmentIds: this.equipmentIds(),
    mobilityAreaIds: this.areaIds(),
    region: this.region() ?? undefined,
    movementType: this.movement() ?? undefined,
    isometric: tri(this.isometric()),
    unilateral: tri(this.unilateral()),
    includeArchived: this.includeArchived(),
    sort: this.sort(),
  }));

  readonly exercises = resource({ params: () => this.filter(), loader: ({ params }) => this.repo.list(params) });

  readonly lookups = resource({
    loader: async () => ({
      muscles: await this.lookupRepo.muscles(),
      equipment: await this.lookupRepo.equipment(),
      areas: await this.lookupRepo.mobilityAreas(),
    }),
  });

  readonly countLabel = computed(() => {
    const n = this.exercises.value()?.length ?? 0;
    return n === 1 ? '1 exercício' : `${n} exercícios`;
  });

  constructor() {
    addIcons({ add, libraryOutline, optionsOutline });
  }

  /** Ao voltar do formulário ou da biblioteca, mostra as alterações. */
  ionViewWillEnter(): void {
    this.exercises.reload();
  }

  clearFilters(): void {
    this.muscleIds.set([]);
    this.equipmentIds.set([]);
    this.areaIds.set([]);
    this.region.set(null);
    this.movement.set(null);
    this.isometric.set('any');
    this.unilateral.set('any');
    this.includeArchived.set(false);
  }

  subtitle(e: Exercise): string {
    return [
      e.region ? REGION_LABEL[e.region] : null,
      e.movementType ? MOVEMENT_LABEL[e.movementType] : null,
      METRIC_LABEL[e.metricType],
      e.equipmentName,
    ]
      .filter(Boolean)
      .join(' · ');
  }
}

function tri(v: TriState): boolean | undefined {
  return v === 'any' ? undefined : v === 'yes';
}
