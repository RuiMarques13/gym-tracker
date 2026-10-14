import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  NavController,
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/ui/toast.service';
import { SettingsService } from '../../core/settings/settings.service';
import {
  Kind,
  CATEGORIES,
  CATEGORY_HINT,
  CATEGORY_LABEL,
  Category,
  KIND_LABEL,
  KIND_OF_CATEGORY,
  defaultCategory,
  METRIC_LABEL,
  MetricType,
  METRICS_BY_KIND,
  Mechanic,
  MovementType,
  Region,
  REGION_LABEL,
} from '../../data/models/enums';
import { Exercise, ExerciseInput, ExerciseValidationError } from '../../data/models/exercise';
import { figureOfMuscleIds, specOfMuscleIds } from '../../core/metrics/muscles';
import { motionFor } from '../../core/motion/motion';
import { SHOW_MOTION } from '../../core/motion/motion-flag';
import { ids } from '../../core/util/uuid';
import { ExerciseMotionComponent } from '../../shared/exercise-motion.component';
import { MuscleMapComponent } from '../../shared/muscle-map.component';
import { EquipmentError, MuscleGroup, NamedItem } from '../../data/repositories/lookup.repository';
import { EXERCISE_REPOSITORY, LOOKUP_REPOSITORY } from '../../data/repositories/providers';
import { toastHtml } from '../../core/ui/toast-text';
const EQUIPMENT_KEYS = ['machine', 'cable', 'dumbbell', 'barbell', 'bodyweight', 'band', 'kettlebell', 'other', 'treadmill', 'bike', 'elliptical', 'rower', 'stair', 'skierg'];

type MuscleRole = 'primary' | 'secondary';

const REGIONS: Region[] = ['UPPER', 'LOWER', 'CORE', 'FULL_BODY'];

/**
 * Criar ou editar um exercício. Os campos mudam conforme o tipo:
 * força (músculos, push/pull, isométrico), mobilidade (áreas, sem carga), cardio (duração).
 */
@Component({
  selector: 'app-exercise-form',
  imports: [MuscleMapComponent, ExerciseMotionComponent, 
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonFooter, IonList,
    IonListHeader, IonItem, IonLabel, IonInput, IonTextarea, IonToggle, IonSelect, IonSelectOption, IonSegment,
    IonSegmentButton, IonChip, IonNote, IonBadge, IonSpinner, RouterLink,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/exercicios" text="" /></ion-buttons>
        <ion-title>{{ isNew() ? 'Novo exercício' : 'Editar exercício' }}</ion-title>
        @if (archivedAt()) {
          <ion-badge slot="end" color="medium" class="archived">Arquivado</ion-badge>
        }
        @if (!isNew()) {
          <ion-buttons slot="end"><ion-button [routerLink]="['/exercicios', id(), 'historico']">Histórico</ion-button></ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="center"><ion-spinner /></div>
      } @else {
        <div class="page">
          <ion-list lines="full">
            <ion-item>
              <ion-input
                label="Nome" labelPlacement="stacked" placeholder="Ex.: Remada sentada"
                [value]="name()" (ionInput)="name.set($any($event).detail.value ?? ''); nameError.set(null)"
                [class.ion-invalid]="!!nameError()" [class.ion-touched]="!!nameError()" [errorText]="nameError() ?? ''"
              />
            </ion-item>

            <ion-list-header><ion-label>Categoria</ion-label></ion-list-header>
            <div class="cats" role="radiogroup" aria-label="Categoria do exercício">
              @for (c of categories; track c) {
                <ion-chip [outline]="category() !== c" role="radio" [attr.aria-checked]="category() === c" (click)="setCategory(c)">
                  {{ categoryLabel[c] }}
                </ion-chip>
              }
            </div>
            <ion-item lines="none"><ion-note class="hint">{{ categoryHint[category()] }}</ion-note></ion-item>

            <ion-item>
              <ion-select label="Medida" interface="popover" [value]="metricType()"
                (ionChange)="metricType.set($any($event).detail.value)" [disabled]="allowedMetrics().length === 1">
                @for (m of allowedMetrics(); track m) {
                  <ion-select-option [value]="m">{{ metricLabel[m] }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
            @if (kind() === 'CARDIO') {
              <ion-item lines="none"><ion-note class="hint">Em cada sessão registas o tempo e, se quiseres, a distância e as calorias.</ion-note></ion-item>
            }

            @if (kind() !== 'CARDIO') {
              <ion-item>
                <ion-toggle [checked]="isUnilateral()" (ionChange)="isUnilateral.set($any($event).detail.checked)">
                  Unilateral
                  <p class="sub">Regista esquerdo e direito em cada série</p>
                </ion-toggle>
              </ion-item>
            }
            @if (kind() === 'STRENGTH') {
              <ion-item>
                <ion-toggle [checked]="isIsometric()" (ionChange)="isIsometric.set($any($event).detail.checked)">
                  Isométrico
                  <p class="sub">Manter uma posição (prancha, wall sit…)</p>
                </ion-toggle>
              </ion-item>
              <ion-item>
                <ion-select label="Região" interface="popover" placeholder="—" [value]="region()"
                  (ionChange)="region.set($any($event).detail.value)">
                  <ion-select-option [value]="null">—</ion-select-option>
                  @for (r of regions; track r) {
                    <ion-select-option [value]="r">{{ regionLabel[r] }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label>Push / Pull</ion-label>
                <ion-segment class="small" slot="end" [value]="movementType() ?? 'NONE'"
                  (ionChange)="setMovement($any($event).detail.value)">
                  <ion-segment-button value="NONE"><ion-label>—</ion-label></ion-segment-button>
                  <ion-segment-button value="PUSH"><ion-label>Push</ion-label></ion-segment-button>
                  <ion-segment-button value="PULL"><ion-label>Pull</ion-label></ion-segment-button>
                </ion-segment>
              </ion-item>
              <ion-item>
                <ion-label class="ion-text-wrap">Articulações<p>Decide quanto sobe a carga sugerida</p></ion-label>
                <ion-segment class="small" slot="end" [value]="mechanic() ?? 'NONE'"
                  (ionChange)="setMechanic($any($event).detail.value)">
                  <ion-segment-button value="NONE"><ion-label>—</ion-label></ion-segment-button>
                  <ion-segment-button value="COMPOUND"><ion-label>Multi</ion-label></ion-segment-button>
                  <ion-segment-button value="ISOLATION"><ion-label>Mono</ion-label></ion-segment-button>
                </ion-segment>
              </ion-item>
            }

            <ion-item>
              <ion-select label="Equipamento" interface="popover" placeholder="Nenhum" [value]="equipmentId()"
                (ionChange)="onEquipment($event)">
                <ion-select-option [value]="null">Nenhum</ion-select-option>
                @for (e of equipment(); track e.id) {
                  <ion-select-option [value]="e.id">{{ e.name }}</ion-select-option>
                }
                <ion-select-option [value]="NEW_EQUIPMENT">+ Novo equipamento…</ion-select-option>
              </ion-select>
            </ion-item>

            @if (kind() !== 'STRENGTH' && motion(); as mo) {
              <div class="visual"><app-exercise-motion [motion]="mo" [equipment]="equipmentKey()" /></div>
            }
            @if (kind() !== 'MOBILITY') {
              <ion-list-header>
                <ion-label>
                  Músculos
                  <p class="legend">
                    Toca uma vez para <span class="dot primary"></span> principal, outra para
                    <span class="dot secondary"></span> secundário, outra para tirar.
                  </p>
                </ion-label>
              </ion-list-header>
              <div class="visual">
                @if (kind() === 'STRENGTH' && motion(); as mo) { <app-exercise-motion [motion]="mo" [equipment]="equipmentKey()" /> }
                <app-muscle-map [primary]="figPrimary()" [secondary]="figSecondary()" />
              </div>
              @for (group of muscleGroups(); track group.region) {
                <div class="chips-block">
                  <span class="chips-title">{{ group.label }}</span>
                  <div class="chips">
                    @for (m of group.muscles; track m.id) {
                      <ion-chip
                        [color]="muscleRole(m.id) ? 'primary' : undefined"
                        [outline]="muscleRole(m.id) !== 'primary'"
                        [class.secondary]="muscleRole(m.id) === 'secondary'"
                        (click)="cycleMuscle(m.id)"
                      >{{ m.name }}</ion-chip>
                    }
                  </div>
                </div>
              }
            } @else {
              <ion-list-header><ion-label>Áreas de mobilidade</ion-label></ion-list-header>
              <div class="chips-block">
                <div class="chips">
                  @for (a of areas(); track a.id) {
                    <ion-chip [color]="selectedAreas().has(a.id) ? 'success' : undefined"
                      [outline]="!selectedAreas().has(a.id)" (click)="toggleArea(a.id)">{{ a.name }}</ion-chip>
                  }
                </div>
              </div>
            }

            <ion-list-header><ion-label>Outros</ion-label></ion-list-header>
            <ion-item>
              <ion-input label="Descanso por defeito (s)" labelPlacement="stacked" type="number" inputmode="numeric"
                min="0" [placeholder]="restPlaceholder()" [value]="restSeconds()"
                (ionInput)="setRest($any($event).detail.value)" />
            </ion-item>
            <ion-item>
              <ion-textarea label="Notas" labelPlacement="stacked" [autoGrow]="true" [value]="notes()"
                (ionInput)="notes.set($any($event).detail.value ?? '')" />
            </ion-item>
            <ion-item>
              <ion-input label="Link de vídeo" labelPlacement="stacked" type="url" placeholder="https://"
                [value]="videoUrl()" (ionInput)="videoUrl.set($any($event).detail.value ?? '')" />
              @if (validVideoUrl(); as url) {
                <ion-button slot="end" fill="clear" [href]="url" target="_blank" rel="noopener">Abrir</ion-button>
              }
            </ion-item>
          </ion-list>

          @if (!isNew()) {
            <div class="danger-zone">
              @if (archivedAt()) {
                <ion-button expand="block" fill="outline" (click)="restore()">Restaurar</ion-button>
              } @else {
                <ion-button expand="block" fill="outline" color="medium" (click)="archive()">Arquivar</ion-button>
              }
              @if (!used()) {
                <ion-button expand="block" fill="clear" color="danger" (click)="remove()">Apagar de vez</ion-button>
              } @else {
                <p class="hint center-text">Já foi usado em treinos, por isso só pode ser arquivado.</p>
              }
            </div>
          }
        </div>
      }
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <div class="footer">
          <ion-button expand="block" (click)="save()" [disabled]="saving() || loading()">
            {{ saving() ? 'A guardar…' : 'Guardar' }}
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    .cats { display: flex; flex-wrap: wrap; gap: 2px; padding: 0 12px 4px; }
    .visual { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; justify-content: center; padding: 8px 16px; }
    .visual > * { flex: 1 1 150px; min-width: 0; }
    .page { max-width: 720px; margin: 0 auto; padding-bottom: 24px; }
    .center { display: flex; justify-content: center; padding: 48px; }
    .archived { margin-right: 12px; }
    ion-segment { margin: 2px 0 8px; }
    ion-segment.small { width: 220px; margin: 6px 0; }
    .sub { margin: 2px 0 0; font-size: 0.8rem; color: var(--ion-color-medium); }
    .hint { font-size: 0.85rem; }
    .legend { font-size: 0.8rem; color: var(--ion-color-medium); margin: 4px 0 0; text-transform: none; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; vertical-align: middle; }
    .dot.primary { background: var(--ion-color-primary); }
    .dot.secondary { border: 2px solid var(--ion-color-primary); }
    .chips-block { padding: 4px 12px 8px; }
    .chips-title { display: block; font-size: 0.75rem; font-weight: 600; color: var(--ion-color-medium); margin: 6px 4px 2px; text-transform: uppercase; letter-spacing: 0.04em; }
    .chips { display: flex; flex-wrap: wrap; }
    ion-chip.secondary { border-width: 2px; }
    .danger-zone { padding: 24px 16px 0; display: grid; gap: 8px; }
    .center-text { text-align: center; color: var(--ion-color-medium); }
    .footer { max-width: 720px; margin: 0 auto; padding: 4px 12px; }
  `,
})
export class ExerciseFormPage implements OnInit {
  private readonly repo = inject(EXERCISE_REPOSITORY);
  private readonly lookups = inject(LOOKUP_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastService);
  private readonly alerts = inject(AlertController);

  /** Vem da rota: /exercicios/novo (sem id) ou /exercicios/:id. */
  readonly id = input<string | undefined>();

  readonly regions = REGIONS;
  readonly kindLabel = KIND_LABEL;
  readonly categoryLabel = CATEGORY_LABEL;
  readonly categories = CATEGORIES;
  readonly categoryHint = CATEGORY_HINT;
  readonly metricLabel = METRIC_LABEL;
  readonly regionLabel = REGION_LABEL;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly used = signal(false);
  readonly archivedAt = signal<string | null>(null);

  readonly name = signal('');
  readonly nameError = signal<string | null>(null);
  readonly kind = signal<Kind>('STRENGTH');
  readonly category = signal<Category>('STRENGTH');
  readonly metricType = signal<MetricType>('WEIGHT_REPS');
  readonly isUnilateral = signal(false);
  readonly isIsometric = signal(false);
  readonly region = signal<Region | null>(null);
  readonly movementType = signal<MovementType | null>(null);
  readonly mechanic = signal<Mechanic | null>(null);
  readonly equipmentId = signal<string | null>(null);
  readonly restSeconds = signal<number | null>(null);
  readonly notes = signal('');
  readonly videoUrl = signal('');
  readonly muscleRoles = signal(new Map<string, MuscleRole>());
  readonly selectedAreas = signal(new Set<string>());

  readonly muscles = signal<MuscleGroup[]>([]);
  readonly equipment = signal<NamedItem[]>([]);
  readonly areas = signal<NamedItem[]>([]);

  readonly isNew = computed(() => !this.id());
  readonly allowedMetrics = computed(() => METRICS_BY_KIND[this.kind()]);
  readonly restPlaceholder = computed(() =>
    this.kind() === 'MOBILITY' ? 'Sem descanso' : `Usa o global (${this.settings.get('defaultRestSeconds')()} s)`,
  );
  readonly validVideoUrl = computed(() => (/^https?:\/\/\S+$/i.test(this.videoUrl().trim()) ? this.videoUrl().trim() : null));
  /** Chave do equipamento escolhido (os IDs são determinísticos), para desenhar o implemento certo. */
  readonly equipmentKey = computed(() => EQUIPMENT_KEYS.find((k) => ids.equipment(k) === this.equipmentId()) ?? 'none');
  readonly motion = computed(() => (SHOW_MOTION ? motionFor(this.name(), this.specPrimary(), this.kind()) : null));
  readonly specPrimary = computed(() =>
    specOfMuscleIds([...this.muscleRoles()].filter(([, r]) => r === 'primary').map(([id]) => id)),
  );
  readonly specSecondary = computed(() =>
    specOfMuscleIds([...this.muscleRoles()].filter(([, r]) => r === 'secondary').map(([id]) => id)),
  );
  /** Zonas do boneco (mais finas que o spec: oblíquos, glúteo médio, tibial). */
  readonly figPrimary = computed(() =>
    figureOfMuscleIds([...this.muscleRoles()].filter(([, r]) => r === 'primary').map(([id]) => id)),
  );
  readonly figSecondary = computed(() =>
    figureOfMuscleIds([...this.muscleRoles()].filter(([, r]) => r === 'secondary').map(([id]) => id)),
  );
  readonly muscleGroups = computed(() =>
    REGIONS.map((r) => ({ region: r, label: REGION_LABEL[r], muscles: this.muscles().filter((m) => (m.region ?? 'FULL_BODY') === r) }))
      .filter((g) => g.muscles.length),
  );

  async ngOnInit(): Promise<void> {
    const [muscles, equipment, areas] = await Promise.all([
      this.lookups.muscles(), this.lookups.equipment(), this.lookups.mobilityAreas(),
    ]);
    this.muscles.set(muscles);
    this.equipment.set(equipment);
    this.areas.set(areas);

    const id = this.id();
    if (id) {
      const ex = await this.repo.get(id);
      if (!ex) {
        await this.toast('Exercício não encontrado.', 'danger');
        this.nav.navigateBack('/exercicios');
        return;
      }
      this.fill(ex);
      this.used.set(await this.repo.isUsed(id));
    }
    this.loading.set(false);
  }

  private fill(ex: Exercise): void {
    this.name.set(ex.name);
    this.kind.set(ex.kind);
    this.category.set(ex.category);
    this.metricType.set(ex.metricType);
    this.isUnilateral.set(ex.isUnilateral);
    this.isIsometric.set(ex.isIsometric);
    this.region.set(ex.region);
    this.movementType.set(ex.movementType);
    this.mechanic.set(ex.mechanic);
    this.equipmentId.set(ex.equipmentId);
    this.restSeconds.set(ex.defaultRestSeconds);
    this.notes.set(ex.notes ?? '');
    this.videoUrl.set(ex.videoUrl ?? '');
    this.archivedAt.set(ex.archivedAt);
    const roles = new Map<string, MuscleRole>();
    ex.primaryMuscleIds.forEach((m) => roles.set(m, 'primary'));
    ex.secondaryMuscleIds.forEach((m) => roles.set(m, 'secondary'));
    this.muscleRoles.set(roles);
    this.selectedAreas.set(new Set(ex.mobilityAreaIds));
  }

  /** A categoria é a escolha do utilizador; o tipo (comportamento) deduz-se dela. */
  setCategory(c: Category): void {
    this.setKind(KIND_OF_CATEGORY[c]);
    this.category.set(c);
  }

  setKind(kind: Kind): void {
    this.kind.set(kind);
    if (KIND_OF_CATEGORY[this.category()] !== kind) this.category.set(defaultCategory(kind));
    if (!METRICS_BY_KIND[kind].includes(this.metricType())) this.metricType.set(METRICS_BY_KIND[kind][0]);
    if (kind === 'CARDIO' && !this.region()) this.region.set('FULL_BODY');
  }

  readonly NEW_EQUIPMENT = '__novo__';

  async onEquipment(ev: Event): Promise<void> {
    const select = ev.target as HTMLIonSelectElement;
    const value = (ev as CustomEvent).detail.value as string | null;
    if (value !== this.NEW_EQUIPMENT) {
      this.equipmentId.set(value);
      return;
    }
    select.value = this.equipmentId(); // volta ao que estava enquanto pergunta o nome
    const alert = await this.alerts.create({
      header: 'Novo equipamento',
      inputs: [{ name: 'name', type: 'text', placeholder: 'Ex.: Bosu, Anilhas, Trenó', attributes: { maxlength: 40 } }],
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Adicionar', role: 'confirm' }],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    try {
      const item = await this.lookups.addEquipment(String(data?.values?.name ?? ''));
      this.equipment.set(await this.lookups.equipment());
      this.equipmentId.set(item.id);
      select.value = item.id;
      await this.toast(`«${item.name}» está nos teus equipamentos.`, 'success');
    } catch (err) {
      await this.toast(err instanceof EquipmentError ? err.message : 'Não foi possível adicionar o equipamento.', 'danger');
    }
  }

  setMechanic(value: string): void {
    this.mechanic.set(value === 'COMPOUND' || value === 'ISOLATION' ? value : null);
  }

  setMovement(value: string): void {
    this.movementType.set(value === 'PUSH' || value === 'PULL' ? value : null);
  }

  setRest(value: string | null | undefined): void {
    const n = value === null || value === undefined || value === '' ? null : Math.max(0, Math.round(Number(value)));
    this.restSeconds.set(Number.isFinite(n) ? n : null);
  }

  muscleRole(id: string): MuscleRole | undefined {
    return this.muscleRoles().get(id);
  }

  /** nenhum → principal → secundário → nenhum */
  cycleMuscle(id: string): void {
    const roles = new Map(this.muscleRoles());
    const current = roles.get(id);
    if (!current) roles.set(id, 'primary');
    else if (current === 'primary') roles.set(id, 'secondary');
    else roles.delete(id);
    this.muscleRoles.set(roles);
  }

  toggleArea(id: string): void {
    const s = new Set(this.selectedAreas());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.selectedAreas.set(s);
  }

  private toInput(): ExerciseInput {
    const roles = [...this.muscleRoles()];
    return {
      id: this.id(),
      name: this.name(),
      kind: this.kind(),
      category: this.category(),
      metricType: this.metricType(),
      isUnilateral: this.isUnilateral(),
      isIsometric: this.isIsometric(),
      region: this.kind() === 'MOBILITY' ? null : this.region(),
      movementType: this.movementType(),
      mechanic: this.mechanic(),
      equipmentId: this.equipmentId(),
      defaultRestSeconds: this.restSeconds(),
      notes: this.notes(),
      videoUrl: this.videoUrl(),
      primaryMuscleIds: roles.filter(([, r]) => r === 'primary').map(([m]) => m),
      secondaryMuscleIds: roles.filter(([, r]) => r === 'secondary').map(([m]) => m),
      mobilityAreaIds: [...this.selectedAreas()],
    };
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const ex = await this.repo.save(this.toInput());
      await this.toast(this.isNew() ? `«${ex.name}» criado.` : 'Alterações guardadas.', 'success');
      this.nav.navigateBack('/exercicios');
    } catch (err) {
      if (err instanceof ExerciseValidationError) {
        if (err.field === 'name') this.nameError.set(err.message);
        else await this.toast(err.message, 'danger');
      } else {
        console.error(err);
        await this.toast('Não foi possível guardar.', 'danger');
      }
    } finally {
      this.saving.set(false);
    }
  }

  async archive(): Promise<void> {
    await this.repo.archive(this.id()!);
    await this.toast('Exercício arquivado. Continua no histórico.', 'success');
    this.nav.navigateBack('/exercicios');
  }

  async restore(): Promise<void> {
    try {
      await this.repo.restore(this.id()!);
      this.archivedAt.set(null);
      await this.toast('Exercício restaurado.', 'success');
    } catch (err) {
      await this.toast(err instanceof ExerciseValidationError ? err.message : 'Não foi possível restaurar.', 'danger');
    }
  }

  async remove(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Apagar exercício?',
      message: toastHtml(`«${this.name()}» vai ser apagado de vez. Esta ação não se desfaz.`),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Apagar', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;
    try {
      await this.repo.remove(this.id()!);
      await this.toast('Exercício apagado.', 'success');
      this.nav.navigateBack('/exercicios');
    } catch (err) {
      await this.toast(err instanceof ExerciseValidationError ? err.message : 'Não foi possível apagar.', 'danger');
    }
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    await this.toasts.show(message, color === 'danger' ? 'error' : 'success');
  }
}
