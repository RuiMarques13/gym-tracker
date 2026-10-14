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
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, copyOutline, linkOutline, trashOutline } from 'ionicons/icons';
import { newId } from '../../core/util/uuid';
import type { Block, Kind, Mechanic, MetricType } from '../../data/models/enums';
import { defaultRest } from '../../core/progression/rest';
import { SettingsService } from '../../core/settings/settings.service';
import type { Exercise } from '../../data/models/exercise';
import {
  BLOCK_LABEL,
  BLOCK_ORDER,
  defaultTargets,
  normalizeSupersets,
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
  /** Do exercício (só para sugerir o descanso). */
  mechanic?: Mechanic | null;
  exerciseRest?: number | null;
}

const BLOCK_HINT: Record<Block, string> = {
  WARMUP: 'Ativação, mobilidade, cardio leve',
  MAIN: 'O resto do treino, pela ordem que fizeres (mobilidade no fim também)',
};
import { ToastService } from '../../core/ui/toast.service';
import { toastHtml } from '../../core/ui/toast-text';

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
                          @if (item.supersetGroup) { <p class="ss">Superset {{ item.supersetGroup }}</p> }
                        </ion-label>
                        @if ($index > 0) {
                          <ion-button slot="end" fill="clear" size="small" [color]="linked(block, $index) ? 'primary' : 'medium'"
                            [attr.aria-pressed]="linked(block, $index)"
                            [attr.aria-label]="linked(block, $index) ? 'Desfazer superset com o anterior' : 'Fazer superset com o anterior'"
                            (click)="$event.stopPropagation(); toggleLink(block, $index)">
                            <ion-icon slot="icon-only" name="link-outline" />
                          </ion-button>
                        }
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
                <p class="hint">Já tem sessões registadas, por isso só pode ser arquivado ou apagado com todo o histórico.</p>
                <ion-button expand="block" fill="clear" color="danger" (click)="removeAll()">Apagar treino e histórico</ion-button>
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
                    <ion-label class="range-label">{{ it.isUnilateral ? 'Repetições por lado' : 'Repetições' }}</ion-label>
                    <div class="range" slot="end">
                      <ion-input aria-label="Mínimo" type="number" inputmode="numeric" min="1" placeholder="mín"
                        [value]="it.targetRepsMin" (ionInput)="patch(it.id, { targetRepsMin: toNum($any($event).detail.value) })" />
                      <span>–</span>
                      <ion-input aria-label="Máximo" type="number" inputmode="numeric" min="1" placeholder="máx"
                        [value]="it.targetReps" (ionInput)="patch(it.id, { targetReps: toNum($any($event).detail.value) })" />
                    </div>
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
                    [placeholder]="restHint(it)" [value]="it.restSeconds"
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
    .range { display: flex; align-items: center; gap: 6px; }
    .range ion-input { width: 56px; text-align: center; --padding-start: 0; --padding-end: 0; }
    .range span { color: var(--ion-color-medium); }
    .page { max-width: 760px; margin: 0 auto; padding-bottom: 24px; }
    .center { display: flex; justify-content: center; padding: 48px; }
    .banner { margin: 12px 16px 0; padding: 10px 14px; border-radius: 10px; background: rgba(var(--ion-color-medium-rgb), 0.15); font-size: 0.9rem; }
    .banner a { color: var(--ion-color-primary); cursor: pointer; font-weight: 600; }
    .ss { color: var(--ion-color-primary); font-weight: 600; }
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
  private readonly settings = inject(SettingsService);
  private readonly modals = inject(ModalController);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastService);
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
    addIcons({ add, copyOutline, linkOutline, trashOutline });
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
          metricType: i.metricType, isUnilateral: i.isUnilateral, archived: i.exerciseArchived, block: i.block, supersetGroup: i.supersetGroup,
          targetSets: i.targetSets, targetRepsMin: i.targetRepsMin, targetReps: i.targetReps, targetDurationSeconds: i.targetDurationSeconds,
          targetWeightKg: i.targetWeightKg, targetDistanceM: i.targetDistanceM, restSeconds: i.restSeconds,
          mechanic: i.exerciseMechanic ?? null, exerciseRest: i.exerciseRestSeconds ?? null,
        })),
      );
      this.used.set(await this.repo.isUsed(id));
    }
    this.loading.set(false);
  }

  /** O descanso que vale se não escreveres nada: do exercício, pelo tipo (IUSCA 2021) ou o global. */
  restHint(it: EditItem): string {
    if (it.kind !== 'STRENGTH') return 'Opcional';
    if (it.exerciseRest) return `Do exercício: ${it.exerciseRest} s`;
    const s = defaultRest(it.mechanic ?? null, this.settings.get('restByMechanic')(), this.settings.get('defaultRestSeconds')());
    return it.mechanic && this.settings.get('restByMechanic')()
      ? `Sugerido: ${s} s (${it.mechanic === 'COMPOUND' ? 'multiarticular' : 'monoarticular'})`
      : `Global: ${s} s`;
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
      mechanic: e.mechanic, exerciseRest: e.defaultRestSeconds,
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
    this.items.set(normalizeSupersets(BLOCK_ORDER.flatMap((b) => (b === block ? inBlock : this.byBlock()[b]))));
  }

  /** O exercício na posição `index` do bloco está em superset com o anterior? */
  linked(block: Block, index: number): boolean {
    const list = this.byBlock()[block];
    const g = list[index]?.supersetGroup;
    return !!g && list[index - 1]?.supersetGroup === g;
  }

  /** Liga/desliga o exercício ao anterior do mesmo bloco (supersets são exercícios seguidos). */
  toggleLink(block: Block, index: number): void {
    const list = this.byBlock()[block];
    const cur = list[index];
    const prev = list[index - 1];
    if (!cur || !prev) return;
    const unlink = this.linked(block, index);
    const group = prev.supersetGroup ?? `g-${prev.id}`;
    this.items.update((all) =>
      normalizeSupersets(all.map((i) => (i.id === cur.id ? { ...i, supersetGroup: unlink ? null : group }
        : i.id === prev.id && !unlink ? { ...i, supersetGroup: group } : i))),
    );
  }

  patch(id: string, changes: Partial<EditItem>): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }

  moveTo(id: string, block: Block): void {
    // Vai para o fim do bloco de destino.
    this.items.update((list) => {
      const item = list.find((i) => i.id === id);
      if (!item || item.block === block) return list;
      return normalizeSupersets([...list.filter((i) => i.id !== id), { ...item, block, supersetGroup: null }]);
    });
  }

  removeItem(id: string): void {
    this.editing.set(null);
    this.items.update((list) => normalizeSupersets(list.filter((i) => i.id !== id)));
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

  /** Apaga o treino e todas as sessões feitas com ele: tira os dados da home, do histórico e dos gráficos. */
  async removeAll(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Apagar treino e histórico?',
      message: toastHtml(`«${this.name()}» e todas as sessões feitas com ele vão ser apagados de vez (séries, volumes, dados de saúde). Deixam de contar na home, no histórico e nos gráficos. Esta ação não se desfaz.`),
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Apagar tudo', role: 'destructive' }],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'destructive') return;
    try {
      const n = await this.repo.removeWithSessions(this.id()!);
      await this.toast(`Treino e ${n} ${n === 1 ? 'sessão apagados' : 'sessões apagadas'}.`, 'success');
      this.nav.navigateBack('/treinos');
    } catch {
      await this.toast('Não foi possível apagar.', 'danger');
    }
  }

  async remove(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Apagar treino?',
      message: toastHtml(`«${this.name()}» vai ser apagado de vez, com os planeados que tiver. Esta ação não se desfaz.`),
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
    await this.toasts.show(message, color === 'danger' ? 'error' : 'success');
  }
}
