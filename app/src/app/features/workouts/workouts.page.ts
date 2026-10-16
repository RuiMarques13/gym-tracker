import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToggle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, clipboardOutline, play } from 'ionicons/icons';
import { BLOCK_LABEL, BLOCK_ORDER, WorkoutSummary, WorkoutValidationError } from '../../data/models/workout';
import { WORKOUT_REPOSITORY } from '../../services/repositories';
import { SessionLauncher } from '../session/session-launcher';

/** Os teus treinos (templates). Deslizar para copiar ou arquivar; tocar para editar. */
import { ToastService } from '../../services/ui/toast.service';

@Component({
  selector: 'app-workouts',
  imports: [NavButtonComponent, 
    RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonList, IonItem,
    IonItemSliding, IonItemOptions, IonItemOption, IonLabel, IonNote, IonBadge, IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <app-nav-button slot="start" />
        <ion-title>Treinos</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/treinos/novo"><ion-icon slot="start" name="add" /> Novo</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        @if (!workouts.isLoading() && !workouts.value()?.length && !showArchived()) {
          <div class="empty">
            <ion-icon name="clipboard-outline" />
            <h2>Ainda não tens treinos</h2>
            <p>Cria um treino com aquecimento e parte principal; mobilidade, musculação ou cardio, em qualquer um. Depois é só começar a sessão a partir dele.</p>
            <ion-button routerLink="/treinos/novo">Criar o primeiro treino</ion-button>
          </div>
        } @else {
          <ion-list lines="full">
            @for (w of workouts.value() ?? []; track w.id) {
              <ion-item-sliding>
                <ion-item [routerLink]="['/treinos', w.id]" [detail]="true">
                  <ion-label class="ion-text-wrap">
                    <h2>{{ w.name }} @if (w.archivedAt) { <ion-badge color="medium">Arquivado</ion-badge> }</h2>
                    <p>{{ describe(w) }}</p>
                    @if (w.notes) { <p class="notes">{{ w.notes }}</p> }
                  </ion-label>
                  @if (!w.archivedAt && w.exerciseCount) {
                    <ion-button slot="end" fill="solid" size="default" class="play" (click)="startSession(w, $event)" aria-label="Iniciar treino">
                      <ion-icon slot="start" name="play" /> Iniciar
                    </ion-button>
                  }
                </ion-item>
                <ion-item-options side="end">
                  <ion-item-option color="medium" (click)="copy(w)">Copiar</ion-item-option>
                  @if (!w.archivedAt) {
                    <ion-item-option color="warning" (click)="archive(w)">Arquivar</ion-item-option>
                  }
                </ion-item-options>
              </ion-item-sliding>
            }
          </ion-list>
          <ion-list lines="none">
            <ion-item>
              <ion-toggle [checked]="showArchived()" (ionChange)="showArchived.set($any($event).detail.checked)">
                <ion-note>Mostrar arquivados</ion-note>
              </ion-toggle>
            </ion-item>
          </ion-list>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    h2 { font-weight: 600; display: flex; gap: 6px; align-items: center; }
    .notes { font-style: italic; }
    .play { --border-radius: 20px; margin-inline-start: 8px; }
    .empty { max-width: 380px; margin: 14vh auto 0; text-align: center; padding: 0 16px; }
    .empty ion-icon { font-size: 44px; color: var(--ion-color-primary); }
    .empty h2 { justify-content: center; margin: 10px 0 6px; font-weight: 700; }
    .empty p { color: var(--ion-color-medium); margin: 0 0 18px; }
  `,
})
export class WorkoutsPage implements ViewWillEnter {
  private readonly repo = inject(WORKOUT_REPOSITORY);
  private readonly toasts = inject(ToastService);
  private readonly launcher = inject(SessionLauncher);

  readonly showArchived = signal(false);
  readonly workouts = resource({
    params: () => ({ includeArchived: this.showArchived() }),
    loader: ({ params }) => this.repo.list(params),
  });

  constructor() {
    addIcons({ add, clipboardOutline, play });
  }

  ionViewWillEnter(): void {
    this.workouts.reload();
  }

  describe(w: WorkoutSummary): string {
    if (!w.exerciseCount) return 'Sem exercícios';
    const blocks = BLOCK_ORDER.filter((b) => w.blockCounts[b]).map((b) => `${BLOCK_LABEL[b]} ${w.blockCounts[b]}`);
    return `${w.exerciseCount} ${w.exerciseCount === 1 ? 'exercício' : 'exercícios'} · ${blocks.join(' · ')}`;
  }

  async startSession(w: WorkoutSummary, ev: Event): Promise<void> {
    ev.stopPropagation();
    ev.preventDefault();
    await this.launcher.start(w.id);
  }

  async copy(w: WorkoutSummary): Promise<void> {
    const c = await this.repo.copy(w.id);
    await this.toast(`Criada «${c.name}».`, 'success');
    this.workouts.reload();
  }

  async archive(w: WorkoutSummary): Promise<void> {
    try {
      await this.repo.archive(w.id);
      await this.toast(`«${w.name}» arquivado.`, 'success');
      this.workouts.reload();
    } catch (err) {
      await this.toast(err instanceof WorkoutValidationError ? err.message : 'Não foi possível arquivar.', 'danger');
    }
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    await this.toasts.show(message, color === 'danger' ? 'error' : 'success');
  }
}
