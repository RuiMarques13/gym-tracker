import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  AlertController, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, chevronBack, chevronForward, closeCircleOutline, play, trashOutline } from 'ionicons/icons';
import { CLOCK } from '../../core/util/clock';
import { addDays, toLocalDate, weekDays, weekStartOf } from '../../core/util/week';
import { ScheduledWorkout, STATUS_LABEL } from '../../data/models/scheduled';
import { SCHEDULED_REPOSITORY, WORKOUT_REPOSITORY } from '../../data/repositories/providers';
import { SessionLauncher } from '../session/session-launcher';

/** Semana de treinos planeados: planear um treino num dia, iniciar, saltar ou tirar. */
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-planned',
  imports: [NavButtonComponent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonBadge],
  template: `
    <ion-header>
      <ion-toolbar>
        <app-nav-button slot="start" />
        <ion-title>Planeados</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="goToday()" [disabled]="isThisWeek()">Hoje</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <div class="nav">
          <ion-button fill="clear" (click)="shift(-7)" aria-label="Semana anterior"><ion-icon slot="icon-only" name="chevron-back" /></ion-button>
          <strong>{{ rangeLabel() }}</strong>
          <ion-button fill="clear" (click)="shift(7)" aria-label="Semana seguinte"><ion-icon slot="icon-only" name="chevron-forward" /></ion-button>
        </div>

        @for (d of days(); track d.date) {
          <section class="day" [class.today]="d.date === today()">
            <header>
              <div>
                <strong>{{ d.weekday }}</strong>
                <span>{{ d.label }}</span>
              </div>
              <ion-button size="small" fill="clear" (click)="plan(d.date)" [attr.aria-label]="'Planear em ' + d.label">
                <ion-icon slot="start" name="add" /> Planear
              </ion-button>
            </header>
            @for (w of byDate().get(d.date) ?? []; track w.id) {
              <div class="item" [class.skipped]="w.status === 'SKIPPED'">
                <div class="what">
                  <span class="name">{{ w.templateName }}</span>
                  @if (w.status !== 'PLANNED') { <ion-badge [color]="w.status === 'DONE' ? 'success' : 'medium'">{{ label[w.status] }}</ion-badge> }
                </div>
                <div class="actions">
                  @if (w.status === 'PLANNED') {
                    <ion-button size="small" (click)="start(w)"><ion-icon slot="start" name="play" /> Iniciar</ion-button>
                    <ion-button size="small" fill="clear" color="medium" (click)="skip(w)" aria-label="Saltar"><ion-icon slot="icon-only" name="close-circle-outline" /></ion-button>
                  }
                  <ion-button size="small" fill="clear" color="medium" (click)="remove(w)" aria-label="Tirar do plano"><ion-icon slot="icon-only" name="trash-outline" /></ion-button>
                </div>
              </div>
            }
          </section>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; padding: 0 12px 24px; }
    .nav { display: flex; align-items: center; justify-content: space-between; }
    .day { border-top: 1px solid var(--ion-color-step-150, rgba(127,127,127,0.25)); padding: 6px 0; }
    .day.today header strong { color: var(--ion-color-primary); }
    header { display: flex; justify-content: space-between; align-items: center; }
    header strong { display: inline-block; min-width: 118px; }
    header span { color: var(--ion-color-medium); font-size: 0.9rem; }
    .item { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 4px 6px 8px; margin: 2px 0 6px;
      border-radius: 10px; background: var(--ion-background-color-step-50, rgba(127,127,127,0.08)); }
    .what { display: flex; gap: 8px; align-items: center; min-width: 0; }
    .name { font-weight: 600; }
    .item.skipped .name { text-decoration: line-through; color: var(--ion-color-medium); }
    .actions { display: flex; align-items: center; flex: none; }
  `,
})
export class PlannedPage implements ViewWillEnter {
  private readonly repo = inject(SCHEDULED_REPOSITORY);
  private readonly workouts = inject(WORKOUT_REPOSITORY);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastService);
  private readonly clock = inject(CLOCK);
  private readonly launcher = inject(SessionLauncher);

  readonly label = STATUS_LABEL;
  readonly today = computed(() => toLocalDate(this.clock.now()));
  readonly weekStart = signal(weekStartOf(toLocalDate(this.clock.now())));
  readonly isThisWeek = computed(() => this.weekStart() === weekStartOf(this.today()));
  readonly days = computed(() =>
    weekDays(this.weekStart()).map((date) => {
      const d = new Date(date + 'T12:00');
      const wd = d.toLocaleDateString('pt-PT', { weekday: 'long' });
      return { date, weekday: wd.charAt(0).toUpperCase() + wd.slice(1), label: d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '') };
    }),
  );
  readonly rangeLabel = computed(() => {
    const f = (s: string) => new Date(s + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '');
    return `${f(this.weekStart())} – ${f(addDays(this.weekStart(), 6))}`;
  });

  readonly items = resource({
    params: () => this.weekStart(),
    loader: ({ params }) => this.repo.list(params, addDays(params, 6)),
  });
  readonly byDate = computed(() => {
    const map = new Map<string, ScheduledWorkout[]>();
    for (const w of this.items.value() ?? []) map.set(w.date, [...(map.get(w.date) ?? []), w]);
    return map;
  });

  constructor() {
    addIcons({ add, chevronBack, chevronForward, closeCircleOutline, play, trashOutline });
  }

  ionViewWillEnter(): void {
    this.items.reload();
  }

  shift(days: number): void {
    this.weekStart.update((w) => addDays(w, days));
  }
  goToday(): void {
    this.weekStart.set(weekStartOf(this.today()));
  }

  async plan(date: string): Promise<void> {
    const list = await this.workouts.list();
    if (!list.length) {
      await this.toast('Cria primeiro um treino em Treinos.');
      return;
    }
    const label = new Date(date + 'T12:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    const alert = await this.alerts.create({
      header: 'Planear treino',
      subHeader: label,
      inputs: list.map((w, i) => ({ type: 'radio' as const, label: w.name, value: w.id, checked: i === 0 })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Planear', handler: (templateId: string) => { void this.doPlan(date, templateId); } },
      ],
    });
    await alert.present();
  }

  private async doPlan(date: string, templateId: string): Promise<void> {
    if (!templateId) return;
    await this.repo.schedule(date, templateId);
    this.items.reload();
  }

  async start(w: ScheduledWorkout): Promise<void> {
    await this.launcher.start(w.templateId, w.id);
  }
  async skip(w: ScheduledWorkout): Promise<void> {
    await this.repo.setStatus(w.id, 'SKIPPED');
    this.items.reload();
  }
  async remove(w: ScheduledWorkout): Promise<void> {
    await this.repo.remove(w.id);
    this.items.reload();
  }

  private async toast(message: string): Promise<void> {
    await this.toasts.show(message, 'info');
  }
}
