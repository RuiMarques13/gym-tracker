import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonChip,
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
  AlertController,
} from '@ionic/angular';
import { ToastService } from '../../services/ui/toast.service';
import { addIcons } from 'ionicons';
import { add, libraryOutline, optionsOutline, removeCircleOutline } from 'ionicons/icons';
import {
  Category,
  CATEGORIES,
  isCategory,
  CATEGORY_LABEL,
  Kind,
  KIND_LABEL,
  METRIC_LABEL,
  MOVEMENT_LABEL,
  MovementType,
  Region,
  REGION_LABEL,
} from '../../data/models/enums';
import { Exercise, ExerciseFilter } from '../../data/models/exercise';
import { buildGroupLookup, groupOfExercise } from '../../core/library/exercise-group';
import { EXERCISE_REPOSITORY, LOOKUP_REPOSITORY } from '../../services/repositories';

type KindFilter = 'ALL' | Kind;
type TriState = 'any' | 'yes' | 'no';

const KIND_COLOR: Record<Kind, string> = { STRENGTH: 'primary', MOBILITY: 'success', CARDIO: 'warning' };

/** Os teus exercícios: pesquisa, filtros, ordenação; tocar abre o formulário. */
@Component({
  selector: 'app-exercises',
  imports: [NavButtonComponent, 
    RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonSearchbar,
    IonSegment, IonSegmentButton, IonChip, IonList, IonListHeader, IonItem, IonLabel, IonNote, IonBadge, IonModal,
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
      <div class="filters">
        <div class="chip-row">
          <ion-chip [outline]="group() !== null" (click)="group.set(null)">Todos</ion-chip>
          @for (g of groups(); track g.key) {
            <ion-chip [outline]="group() !== g.key" (click)="group.set(g.key)">{{ g.label }}</ion-chip>
          }
        </div>
        <div class="chip-row">
          <ion-chip class="small" [outline]="category() !== null" (click)="category.set(null)">Todas as categorias</ion-chip>
          @for (c of categories; track c) {
            <ion-chip class="small" [outline]="category() !== c" (click)="category.set(c)">{{ categoryLabel[c] }}</ion-chip>
          }
        </div>
        <div class="chip-row">
          <ion-chip class="small" [outline]="equipmentIds().length > 0" (click)="equipmentIds.set([])">Qualquer equipamento</ion-chip>
          @for (e of lookups.value()?.equipment ?? []; track e.id) {
            <ion-chip class="small" [outline]="equipmentIds()[0] !== e.id" (click)="equipmentIds.set([e.id])">{{ e.name }}</ion-chip>
          }
        </div>
      </div>
    </ion-header>

    <ion-content>
      <div class="page">
        <p class="count">
          {{ countLabel() }}
          @if (activeFilters() > 0) { · <a (click)="clearFilters()">limpar filtros</a> }
        </p>
        <ion-list lines="full">
          @for (e of shown(); track e.id) {
            <ion-item [routerLink]="['/exercicios', e.id]" [detail]="false" button>
              <ion-label>
                <h2>{{ e.name }}</h2>
                <p>{{ subtitle(e) }}</p>
              </ion-label>
              <div slot="end" class="badges">
                @if (e.archivedAt) { <ion-badge color="medium">Arquivado</ion-badge> }
                @if (e.isUnilateral) { <ion-badge color="tertiary">Unilateral</ion-badge> }
                <ion-badge [color]="kindColor[e.kind]">{{ categoryLabel[e.category] }}</ion-badge>
                @if (!e.archivedAt) {
                  <ion-button fill="clear" color="medium" size="small" class="remove" aria-label="Tirar da lista"
                    (click)="$event.stopPropagation(); $event.preventDefault(); removeFromList(e)">
                    <ion-icon slot="icon-only" name="remove-circle-outline" />
                  </ion-button>
                }
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
    .filters { background: var(--ion-toolbar-background, var(--ion-background-color)); padding: 0 0 6px; }
    .chip-row { display: flex; gap: 2px; overflow-x: auto; padding: 0 8px; scrollbar-width: none; }
    .chip-row::-webkit-scrollbar { display: none; }
    ion-chip { flex: 0 0 auto; }
    ion-chip.small { height: 28px; font-size: 0.8rem; }
    .badges { display: flex; gap: 6px; align-items: center; }
    .badges .remove { margin: 0 -8px 0 0; --padding-start: 6px; --padding-end: 6px; }
    ion-badge { font-weight: 500; }
    h2 { font-weight: 600; }
    .count-badge { position: absolute; top: 2px; right: 0; font-size: 0.65rem; padding: 3px 5px; }
  `,
})
export class ExercisesPage implements ViewWillEnter {
  private readonly repo = inject(EXERCISE_REPOSITORY);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastService);

  /**
   * Tira o exercício da tua lista; continua na biblioteca (e volta com «Adicionar» ou «Restaurar»).
   * Nunca usado: apaga. Usado em treinos ou sessões: arquiva, para o histórico e os gráficos ficarem.
   */
  async removeFromList(e: Exercise): Promise<void> {
    const used = await this.repo.isUsed(e.id);
    const alert = await this.alerts.create({
      header: `Tirar «${e.name}» da lista?`,
      message: used
        ? 'Já o usaste: o histórico e os treinos onde está ficam como estão. Continua na biblioteca, de onde o podes restaurar.'
        : 'Continua na biblioteca, de onde o podes voltar a adicionar.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Tirar', role: 'destructive', handler: () => { void this.doRemove(e, used); } },
      ],
    });
    await alert.present();
  }

  private async doRemove(e: Exercise, used: boolean): Promise<void> {
    try {
      if (used) await this.repo.archive(e.id);
      else await this.repo.remove(e.id);
      this.exercises.reload();
      await this.toasts.success(`«${e.name}» saiu da lista.`);
    } catch {
      await this.toasts.error('Não foi possível tirar o exercício.');
    }
  }
  private readonly lookupRepo = inject(LOOKUP_REPOSITORY);

  readonly kindLabel = KIND_LABEL;
  readonly categoryLabel = CATEGORY_LABEL;
  readonly categories = CATEGORIES;
  /** ?category=POWER|HIIT|… vindo da Home. */
  readonly categoryParam = input<string | undefined>(undefined, { alias: 'category' });
  readonly category = linkedSignal<Category | null>(() => {
    const c = this.categoryParam();
    return isCategory(c) ? c : null;
  });
  readonly kindColor = KIND_COLOR;
  readonly regionLabel = REGION_LABEL;
  readonly regions: Region[] = ['UPPER', 'LOWER', 'CORE', 'FULL_BODY'];

  /** ?kind=STRENGTH|MOBILITY|CARDIO vindo da Home. */
  readonly kind = input<string | undefined>();
  /** Grupo da biblioteca escolhido nos chips; ?kind=MOBILITY|CARDIO (da Home) escolhe o grupo respetivo. */
  readonly group = linkedSignal<string | null>(() => {
    const k = this.kind();
    return k === 'MOBILITY' ? 'mobilidade' : k === 'CARDIO' ? 'cardio' : null;
  });
  readonly groups = computed(() => this.library.value()?.groups ?? []);
  private readonly library = resource({ loader: () => import('../../core/library/library-data').then((m) => m.LIBRARY) });
  private readonly groupLookup = computed(() => {
    const lib = this.library.value();
    return lib ? buildGroupLookup(lib) : null;
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
    category: this.category() ?? undefined,
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

  /** Lista pelos chips: sem grupo escolhido mostra tudo; enquanto a biblioteca carrega, também. */
  readonly shown = computed(() => {
    const all = this.exercises.value() ?? [];
    const g = this.group();
    const lk = this.groupLookup();
    return g && lk ? all.filter((e) => groupOfExercise(e, lk) === g) : all;
  });

  readonly lookups = resource({
    loader: async () => ({
      muscles: await this.lookupRepo.muscles(),
      equipment: await this.lookupRepo.equipment(),
      areas: await this.lookupRepo.mobilityAreas(),
    }),
  });

  readonly countLabel = computed(() => {
    const n = this.shown().length;
    return n === 1 ? '1 exercício' : `${n} exercícios`;
  });

  constructor() {
    addIcons({ add, libraryOutline, optionsOutline, removeCircleOutline });
  }

  /** Ao voltar do formulário ou da biblioteca, mostra as alterações. */
  ionViewWillEnter(): void {
    this.exercises.reload();
    this.lookups.reload();
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
    this.category.set(null);
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
