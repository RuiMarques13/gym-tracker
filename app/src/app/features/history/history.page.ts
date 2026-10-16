import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController, IonBadge, IonContent, IonHeader, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList,
  IonListHeader, IonTitle, IonToolbar, ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { timeOutline } from 'ionicons/icons';
import type { SessionSummary } from '../../data/models/session';
import { SESSION_REPOSITORY } from '../../services/repositories';
import { effortLabel } from '../../shared/effort-scale';
import { formatDay, formatMonth, formatSpan, formatVolume } from './history-format';
import { toastHtml } from '../../services/ui/toast-text';

/** Sessões terminadas, da mais recente para a mais antiga, agrupadas por mês. */
@Component({
  selector: 'app-history',
  imports: [NavButtonComponent, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonItemSliding, IonItemOptions, IonItemOption, IonLabel, IonBadge, IonIcon],
  template: `
    <ion-header><ion-toolbar><app-nav-button slot="start" /><ion-title>Histórico</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        @if (!sessions.isLoading() && !sessions.value()?.length) {
          <div class="empty">
            <ion-icon name="time-outline" />
            <h2>Ainda não terminaste nenhuma sessão</h2>
            <p>Quando terminares uma sessão, aparece aqui. Podes corrigir séries e cargas depois.</p>
          </div>
        } @else {
          @for (g of groups(); track g.month) {
            <ion-list lines="full">
              <ion-list-header><ion-label>{{ g.month }}</ion-label></ion-list-header>
              @for (s of g.items; track s.id) {
                <ion-item-sliding #slide>
                <ion-item [routerLink]="['/historico', s.id]" [detail]="true">
                  <ion-label class="ion-text-wrap">
                    <h2>{{ s.templateName ?? 'Sessão livre' }}
                      @if (s.rpe !== null) { <ion-badge color="medium">esforço {{ s.rpe }}{{ effortName(s.rpe) }}</ion-badge> }
                    </h2>
                    <p>{{ day(s.startedAt) }} · {{ span(s) }} · {{ s.setCount }} {{ s.setCount === 1 ? 'série' : 'séries' }}@if (s.volumeKg) { · {{ volume(s.volumeKg) }} }</p>
                  </ion-label>
                </ion-item>
                <ion-item-options side="end">
                  <ion-item-option color="danger" (click)="confirmDelete(s, slide)">Apagar</ion-item-option>
                </ion-item-options>
                </ion-item-sliding>
              }
            </ion-list>
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    h2 { font-weight: 600; display: flex; gap: 6px; align-items: center; }
    .empty { max-width: 380px; margin: 14vh auto 0; text-align: center; padding: 0 16px; }
    .empty ion-icon { font-size: 44px; color: var(--ion-color-primary); }
    .empty h2 { justify-content: center; margin: 10px 0 6px; font-weight: 700; }
    .empty p { color: var(--ion-color-medium); }
  `,
})
export class HistoryPage implements ViewWillEnter {
  private readonly repo = inject(SESSION_REPOSITORY);
  private readonly alerts = inject(AlertController);
  effortName = (v: number): string => {
    const l = effortLabel(v);
    return l ? ' · ' + l.toLowerCase() : '';
  };
  readonly sessions = resource({ loader: () => this.repo.listFinished() });

  readonly groups = computed(() => {
    const out: { month: string; items: SessionSummary[] }[] = [];
    for (const s of this.sessions.value() ?? []) {
      const month = formatMonth(s.startedAt);
      const last = out.at(-1);
      if (last && last.month === month) last.items.push(s);
      else out.push({ month, items: [s] });
    }
    return out;
  });

  constructor() {
    addIcons({ timeOutline });
  }

  ionViewWillEnter(): void {
    this.sessions.reload();
  }

  /** Apaga a sessão (séries incluídas): sai do histórico, da home e das estatísticas. */
  async confirmDelete(s: SessionSummary, slide: IonItemSliding): Promise<void> {
    await slide.close();
    const alert = await this.alerts.create({
      header: 'Apagar a sessão?',
      message: toastHtml(`«${s.templateName ?? 'Sessão livre'}» · ${this.day(s.startedAt)}. Sai do histórico, da home e das estatísticas. Não dá para desfazer.`),
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Apagar', role: 'destructive' }],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'destructive') return;
    await this.repo.discard(s.id);
    this.sessions.reload();
  }

  day = formatDay;
  volume = formatVolume;
  span = (s: SessionSummary) => formatSpan(s.startedAt, s.endedAt);
}
