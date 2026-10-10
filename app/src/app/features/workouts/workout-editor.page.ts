import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonReorder,
  IonReorderGroup,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
  NavController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, copyOutline, trashOutline } from 'ionicons/icons';
import { newId } from '../../core/util/uuid';
import type { Block, Kind, MetricType } from '../../data/models/enums';
import type { Exercise } from '../../data/models/exercise';
import {
  BLOCK_LABEL,
  BLOCK_ORDER,
  defaultTargets,
  PlannedExerciseInput,
  WorkoutValidationError,
} from '../../data/models/workout';
import { WORKOUT_REPOSITORY } from '../../data/repositories/providers';
import { ExercisePickerComponent } from './exercise-picker.component';
import { formatTargets } from './workout-format';

/** Item em edição: o que vai para o repositório mais o que é preciso para mostrar. */
interface EditItem extends PlannedExerciseInput {
  id: string;
  exerciseName: string;
  kind: Kind;
  metricType: MetricType;
  isUnilateral: boolean;
  archived: boolean;
}

const BLOCK_HINT: Record<Block, string> = {
  WARMUP: 'Ativação, mobilidade, cardio leve',
  MAIN: 'O resto do treino, pela ordem que fizeres (mobilidade no fim também)',
};

@Component({
  selector: 'app-workout-editor',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon, IonContent, IonFooter, IonList,
    IonListHeader, IonItem, IonLabel, IonBadge, IonInput, IonTextarea, IonReorderGroup, IonReorder, IonModal,
    IonSegment, IonSegmentButton, IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/treinos" text="" /></ion-buttons>
        <ion-title>{{ isNew() ? 'Novo treino' : 'Editar treino' }}</ion-title>
        @if (!isNew()) {
          <ion-buttons slot="end">
            <ion-button (click)="copy()" aria-label="Copiar treino"><ion-icon slot="icon-only" name="copy-outline" /></ion-button>
          </ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="center"><ion-spinner /></div>
      } @else {
        <div class="page">
          @if (archivedAt()) {
            <div class="banner">Este treino está arquivado. <a (click)="restore()">Restaurar</a></div>
          }
          <ion-list lines="full">
            <ion-item>
              <ion-input label="Nome" labelPlacement="stacked" placeholder="Ex.: Pernas A, Upper, Mobilidade manhã"
                [value]="name()" (ionInput)="name.set($any($event).detail.value ?? ''); nameError.set(null)"
                [class.ion-invalid]="!!nameError()" [class.ion-touched]="!!nameError()" [errorText]="nameError() ?? ''" />
            </ion-item>
            <ion-item>
              <ion-textarea label="Notas" labelPlacement="stacked" [autoGrow]="true" [value]="notes()"
                (ionInput)="notes.set($any($event).detail.value ?? '')" />
            </ion-item>
          </ion-list>

          <p class="summary">{{ summary() }}</p>

          @for (block of blocks; track block) {
            <section class="block">
              <div class="block-head">
                <div>
                  <h3>{{ blockLabel[block] }} <span class="n">{{ byBlock()[block].length || '' }}</span></h3>
                  <p>{{ blockHint[block] }}</p>
                </div>
                <ion-button fill="clear" size="small" (click)="addExercises(block)">
                  <ion-icon slot="start" name="add" /> Adicionar
                </ion-button>
              </div>
              @if (byBlock()[block].length) {
                <ion-list lines="full" class="items">
                  <ion-reorder-group [disabled]="byBlock()[block].length < 2" (ionReorderEnd)="reorder(block, $any($event))">
                    @for (item of byBlock()[block]; track item.id) {
                      <ion-item button [detail]="false" (click)="editing.set(item.id)">
                        <ion-label>
                          <h2>{{ item.exerciseName }}
                            @if (item.archived) { <ion-badge color="medium">Arquivado</ion-badge> }
                          </h2>
                          <p>{{ targetsLabel(item) }}</p>
                        </ion-label>
                        <ion-reorder slot="end" />
                      </ion-item>
                    }
                  </ion-reorder-group>
                </ion-list>
              } @else {
                <p class="empty">Sem exercícios.</p>
              }
            </section>
          }

          @if (!isNew()) {
            <div class="danger-zone">
              @if (!archivedAt()) {
                <ion-button expand="block" fill="outline" color="medium" (click)="archive()">Arquivar</ion-button>
              }
              @if (!used()) {
                <ion-button expand="block" fill="clear" color="danger" (click)="remove()">Apagar de vez</ion-button>
              } @else {
                <p class="hint">Já tem sessões registadas, por isso só pode ser arquivado.</p>
              }
            </div>
          }
        </div>
      }

      <!-- Alvos de um exercício -->
      <ion-modal [isOpen]="!!editingItem()" (didDismiss)="editing.set(null)" [initialBreakpoint]="0.75" [breakpoints]="[0, 0.75, 1]">
        <ng-template>
          @if (editingItem(); as it) {
            <ion-header>
              <ion-toolbar>
                <ion-title>{{ it.exerciseName }}</ion-title>
                <ion-buttons slot="end"><ion-button (click)="editing.set(null)"><strong>OK</strong></ion-button></ion-buttons>
              </ion-toolbar>
            </ion-header>
            <ion-content>
              <ion-list lines="full">
                <ion-item>
                  <ion-input label="Séries" type="number" inputmode="numeric" min="1" [value]="it.targetSets"
                    (ionInput)="patch(it.id, { targetSets: toNum($any($event).detail.value) })" />
                </ion-item>
                @if (it.kind === 'CARDIO') {
                  <ion-item>
                    <ion-input label="Duração (min)" type="number" inputmode="decimal" min="0"
                      [value]="it.targetDurationSeconds ? it.targetDurationSeconds / 60 : null"
                      (ionInput)="patch(it.id, { targetDurationSeconds: minutesToSeconds($any($event).detail.value) })" />
                  </ion-item>
                  <ion-item>
                    <ion-input label="Distância (km)" type="number" inputmode="decimal" min="0"
                      [value]="it.targetDistanceM ? it.targetDistanceM / 1000 : null"
                      (ionInput)="patch(it.id, { targetDistanceM: kmToMeters($any($event).detail.value) })" />
                  </ion-item>
                } @else if (it.metricType === 'DURATION') {
                  <ion-item>
                    <ion-input [label]="it.isUnilateral ? 'Duração por lado (s)' : 'Duração (s)'" type="number"
                      inputmode="numeric" min="0" [value]="it.targetDurationSeconds"
                      (ionInput)="patch(it.id, { targetDurationSeconds: toNum($any($event).detail.value) })" />
                  </ion-item>
                } @else {
                  <ion-item>
                    <ion-input [label]="it.isUnilateral ? 'Reps por lado' : 'Reps'" type="number" inputmode="numeric"
                      min="0" [value]="it.targetReps" (ionInput)="patch(it.id, { targetReps: toNum($any($event).detail.value) })" />
                  </ion-item>
                  @if (it.metricType === 'WEIGHT_REPS') {
                    <ion-item>
                      <ion-input label="Carga alvo (kg)" type="number" inputmode="decimal" min="0" placeholder="Opcional"
                        [value]="it.targetWeightKg" (ionInput)="patch(it.id, { targetWeightKg: toNum($any($event).detail.value) })" />
                    </ion-item>
                  }
                }
                <ion-item>
                  <ion-input label="Descanso (s)" type="number" inputmode="numeric" min="0"
                    placeholder="Do exercício ou global" [value]="it.restSeconds"
                    (ionInput)="patch(it.id, { restSeconds: toNum($any($event).detail.value) })" />
                </ion-item>
                <ion-list-header><ion-label>Bloco</ion-label></ion-list-header>
                <ion-item lines="none">
                  <ion-segment [value]="it.block" (ionChange)="moveTo(it.id, $any($event).detail.value)">
                    @for (b of blocks; track b) {
                      <ion-segment-button [value]="b"><ion-label>{{ blockLabel[b] }}</ion-label></ion-segment-button>
                    }
                  </ion-segment>
                </ion-item>
              </ion-list>
              <div class="sheet-actions">
                <ion-button expand="block" fill="clear" color="danger" (click)="removeItem(it.id)">
                  <ion-icon slot="start" name="trash-outline" /> Tirar do treino
                </ion-button>
              </div>
            </ion-content>
          }
        </ng-template>
      </ion-modal>
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
    .page { max-width: 760px; margin: 0 auto; padding-bottom: 24px; }
    .center { display: flex; justify-content: center; padding: 48px; }
    .banner { margin: 12px 16px 0; padding: 10px 14px; border-radius: 10px; background: rgba(var(--ion-color-medium-rgb), 0.15); font-size: 0.9rem; }
    .banner a { color: var(--ion-color-primary); cursor: pointer; font-weight: 600; }
    .summary { margin: 14px 16px 0; font-size: 0.85rem; color: var(--ion-color-medium); }
    .block { margin-top: 18px; }
    .block-head { display: flex; justify-content: space-between; align-items: center; padding: 0 8px 0 16px; }
    .block-head h3 { margin: 0; font-size: 1.05rem; font-weight: 700; }
    .block-head p { margin: 2px 0 0; font-size: 0.8rem; color: var(--ion-color-medium); }
    .n { font-weight: 500; color: var(--ion-color-medium); font-size: 0.9rem; margin-left: 4px; }
    .items { margin-top: 4px; }
    h2 { font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .empty { margin: 6px 16px; font-size: 0.85rem; color: var(--ion-color-medium); }
    .danger-zone { padding: 28px 16px 0; display: grid; gap: 8px; }
    .hint { text-align: center; color: var(--ion-color-medium); font-size: 0.85rem; }
    .sheet-actions { padding: 12px 16px; }
    .footer { max-width: 760px; margin: 0 auto; padding: 4px 12px; }
  `,
})
export class WorkoutEditorPage {
  private readonly repo = inject(WORKOUT_REPOSITORY);
  private readonly modals = inject(ModalController);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastController);
  private readonly alerts = inject(AlertController);

  readonly id = input<string | undefined>();

  readonly blocks = BLOCK_ORDER;
  readonly blockLabel = BLOCK_LABEL;
  readonly blockHint = BLOCK_HINT;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly used = signal(false);
  readonly archivedAt = signal<string | null>(null);
  readonly name = signal('');
  readonly nameError = signal<string | null>(null);
  readonly notes = signal('');
  readonly items = signal<EditItem[]>([]);
  readonly editing = signal<string | null>(null);

  readonly isNew = computed(() => !this.id());
  readonly byBlock = computed(() => {
    const out: Record<Block, EditItem[]> = { WARMUP: [], MAIN: [] };
    for (const it of this.items()) out[it.block].push(it);
    return out;
  });
  readonly editingItem = computed(() => this.items().find((i) => i.id === this.editing()) ?? null);
  readonly summary = computed(() => {
    const items = this.items();
    if (!items.length) return 'Adiciona exercícios a cada bloco. Podes reordenar arrastando a pega.';
    const sets = items.reduce((s, i) => s + (i.targetSets ?? 0), 0);
    return `${items.length} ${items.length === 1 ? 'exercício' : 'exercícios'} · ${sets} séries no total`;
  });

  constructor() {
    addIcons({ add, copyOutline, trashOutline });
    // Recarrega sempre que o id da rota muda (ex.: depois de copiar, abre a cópia).
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string | undefined): Promise<void> {
    this.loading.set(true);
    if (id) {
      const w = await this.repo.get(id);
      if (!w) {
        await this.toast('Treino não encontrado.', 'danger');
        this.nav.navigateBack('/treinos');
        return;
      }
      this.name.set(w.name);
      this.notes.set(w.notes ?? '');
      this.archivedAt.set(w.archivedAt);
      this.items.set(
        w.items.map((i) => ({
          id: i.id, exerciseId: i.exerciseId, exerciseName: i.exerciseName, kind: i.exerciseKind,
          metricType: i.metricType, isUnilateral: i.isUnilateral, archived: i.exerciseArchived, block: i.block,
          targetSets: i.targetSets, targetReps: i.targetReps, targetDurationSeconds: i.targetDurationSeconds,
          targetWeightKg: i.targetWeightKg, targetDistanceM: i.targetDistanceM, restSeconds: i.restSeconds,
        })),
      );
      this.used.set(await this.repo.isUsed(id));
    }
    this.loading.set(false);
  }

  targetsLabel(it: EditItem): string {
    return formatTargets(it.kind, it.metricType, it.isUnilateral, it);
  }

  async addExercises(block: Block): Promise<void> {
    const modal = await this.modals.create({
      component: ExercisePickerComponent,
      componentProps: {
        title: `Adicionar a ${BLOCK_LABEL[block]}`,
        initialKind: 'ALL',
      },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<Exercise[]>();
    if (role !== 'confirm' || !data?.length) return;
    const added: EditItem[] = data.map((e) => ({
      id: newId(), exerciseId: e.id, exerciseName: e.name, kind: e.kind, metricType: e.metricType,
      isUnilateral: e.isUnilateral, archived: false, block, ...defaultTargets(e.kind, e.metricType),
    }));
    this.items.update((list) => [...list, ...added]);
  }

  /** Reordenar dentro de um bloco: reconstrói a lista mantendo os outros blocos no lugar. */
  reorder(block: Block, ev: CustomEvent<{ from: number; to: number; complete: (d?: unknown) => unknown }>): void {
    const { from, to } = ev.detail;
    const inBlock = [...this.byBlock()[block]];
    const [moved] = inBlock.splice(from, 1);
    inBlock.splice(to, 0, moved);
    ev.detail.complete(false);
    this.items.set(BLOCK_ORDER.flatMap((b) => (b === block ? inBlock : this.byBlock()[b])));
  }

  patch(id: string, changes: Partial<EditItem>): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }

  moveTo(id: string, block: Block): void {
    // Vai para o fim do bloco de destino.
    this.items.update((list) => {
      const item = list.find((i) => i.id === id);
      if (!item || item.block === block) return list;
      return [...list.filter((i) => i.id !== id), { ...item, block }];
    });
  }

  removeItem(id: string): void {
    this.editing.set(null);
    this.items.update((list) => list.filter((i) => i.id !== id));
  }

  toNum(v: string | null | undefined): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  minutesToSeconds(v: string | null | undefined): number | null {
    const n = this.toNum(v);
    return n === null ? null : Math.round(n * 60);
  }
  kmToMeters(v: string | null | undefined): number | null {
    const n = this.toNum(v);
    return n === null ? null : Math.round(n * 1000);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const w = await this.repo.save({
        id: this.id(),
        name: this.name(),
        notes: this.notes(),
        items: this.items().map(({ exerciseName, kind, metricType, isUnilateral, archived, ...input }) => input),
      });
      await this.toast(this.isNew() ? `«${w.name}» criado.` : 'Treino guardado.', 'success');
      this.nav.navigateBack('/treinos');
    } catch (err) {
      if (err instanceof WorkoutValidationError && err.field === 'name') this.nameError.set(err.message);
      else await this.toast(err instanceof WorkoutValidationError ? err.message : 'Não foi possível guardar.', 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  async copy(): Promise<void> {
    try {
      const c = await this.repo.copy(this.id()!);
      await this.toast(`Criada «${c.name}».`, 'success');
      this.nav.navigateForward(['/treinos', c.id]);
    } catch {
      await this.toast('Não foi possível copiar.', 'danger');
    }
  }

  async archive(): Promise<void> {
    await this.repo.archive(this.id()!);
    await this.toast('Treino arquivado.', 'success');
    this.nav.navigateBack('/treinos');
  }

  async restore(): Promise<void> {
    try {
      await this.repo.restore(this.id()!);
      this.archivedAt.set(null);
      await this.toast('Treino restaurado.', 'success');
    } catch (err) {
      await this.toast(err instanceof WorkoutValidationError ? err.message : 'Não foi possível restaurar.', 'danger');
    }
  }

  async remove(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Apagar treino?',
      message: `«${this.name()}» vai ser apagado de vez, com os planeados que tiver. Esta ação não se desfaz.`,
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Apagar', role: 'destructive' }],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'destructive') return;
    try {
      await this.repo.remove(this.id()!);
      await this.toast('Treino apagado.', 'success');
      this.nav.navigateBack('/treinos');
    } catch (err) {
      await this.toast(err instanceof WorkoutValidationError ? err.message : 'Não foi possível apagar.', 'danger');
    }
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toasts.create({ message, color, duration: 2200, position: 'bottom' });
    await t.present();
  }
}
