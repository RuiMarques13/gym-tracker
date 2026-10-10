import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonTitle, IonToolbar, ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { heartOutline } from 'ionicons/icons';
import { HealthService } from '../../core/health/health.service';
import { SESSION_REPOSITORY } from '../../data/repositories/providers';
import { NavButtonComponent } from '../../shared/nav-button.component';
import { formatDay, formatSpan } from '../history/history-format';

/** Os dados do relógio (frequência cardíaca e calorias) de cada treino, à parte do registo de séries. */
@Component({
  selector: 'app-health',
  imports: [NavButtonComponent, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonSpinner],
  template: `
    <ion-header><ion-toolbar><app-nav-button slot="start" /><ion-title>Saúde</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        @if (!available()) {
          <p class="note">A importação do relógio só existe na app Android (Health Connect). {{ reason() }}</p>
        } @else {
          <div class="bar">
            <ion-button size="small" (click)="importRecent()" [disabled]="busy()">
              @if (busy()) { <ion-spinner name="dots" /> } @else { Importar os últimos treinos do relógio }
            </ion-button>
            <a routerLink="/definicoes/relogio">Configurar relógio</a>
          </div>
          @if (message()) { <p class="note">{{ message() }}</p> }
        }
        @if (!rows().length && !loading()) {
          <div class="empty">
            <ion-icon name="heart-outline" />
            <h2>Ainda não há treinos</h2>
            <p>Termina uma sessão e importa os dados do relógio para veres aqui a frequência cardíaca e as calorias.</p>
          </div>
        } @else {
          <ion-list lines="full">
            @for (r of rows(); track r.id) {
              <ion-item [routerLink]="['/saude', r.id]" [detail]="true">
                <ion-label class="ion-text-wrap">
                  <h2>{{ r.name }}</h2>
                  <p>{{ r.day }} · {{ r.span }}</p>
                  @if (r.stats) { <p class="stats">{{ r.stats }}</p> } @else { <p class="none">Sem dados do relógio</p> }
                </ion-label>
              </ion-item>
            }
          </ion-list>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    .bar { display: flex; gap: 16px; align-items: center; padding: 8px 16px; flex-wrap: wrap; }
    .bar a { font-size: 0.85rem; }
    .note { margin: 8px 16px; font-size: 0.85rem; color: var(--ion-color-medium); }
    h2 { font-weight: 600; }
    .stats { color: var(--ion-color-danger); font-weight: 600; }
    .none { color: var(--ion-color-medium); }
    .empty { max-width: 380px; margin: 10vh auto 0; text-align: center; padding: 0 16px; }
    .empty ion-icon { font-size: 44px; color: var(--ion-color-danger); }
    .empty h2 { margin: 10px 0 6px; font-weight: 700; }
    .empty p { color: var(--ion-color-medium); }
  `,
})
export class HealthPage implements ViewWillEnter {
  private readonly health = inject(HealthService);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly refresh = signal(0);

  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly available = signal(true);
  readonly reason = signal('');

  private readonly list = resource({ params: () => this.refresh(), loader: () => this.sessions.listFinished({ limit: 60 }) });
  private readonly summaries = resource({ params: () => this.refresh(), loader: () => this.health.all() });
  readonly loading = computed(() => this.list.isLoading() || this.summaries.isLoading());

  readonly rows = computed(() => {
    const sums = this.summaries.value();
    return (this.list.value() ?? []).map((s) => {
      const h = sums?.get(s.id);
      const parts: string[] = [];
      if (h?.avg != null) parts.push(`${h.avg} bpm médios`);
      if (h?.max != null) parts.push(`máx. ${h.max}`);
      if (h?.caloriesKcal != null) parts.push(`${h.caloriesKcal} kcal`);
      return {
        id: s.id, name: s.templateName ?? 'Sessão livre', day: formatDay(s.startedAt), span: formatSpan(s.startedAt, s.endedAt),
        stats: parts.length ? parts.join(' · ') : null,
      };
    });
  });

  constructor() {
    addIcons({ heartOutline });
  }

  ionViewWillEnter(): void {
    void this.health.availability().then((a) => {
      this.available.set(a.available);
      this.reason.set(a.available ? '' : a.reason);
    });
    this.refresh.update((n) => n + 1);
  }

  /** Importa, por ordem, os 10 treinos mais recentes que ainda não têm dados. */
  async importRecent(): Promise<void> {
    this.busy.set(true);
    this.message.set(null);
    try {
      const have = this.summaries.value() ?? new Map();
      const todo = (this.list.value() ?? []).filter((s) => !have.has(s.id)).slice(0, 10);
      if (!todo.length) {
        this.message.set('Todos os treinos recentes já têm dados.');
        return;
      }
      let done = 0;
      let lastReason = '';
      for (const s of todo) {
        const r = await this.health.importForSession({ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt });
        if (r.ok) done++;
        else {
          lastReason = r.reason;
          if (r.reason.startsWith('Sem permissão')) break;
        }
      }
      this.message.set(done ? `Importados ${done} de ${todo.length} treinos.` : lastReason || 'Nada para importar.');
      this.refresh.update((n) => n + 1);
    } catch (err) {
      this.message.set(err instanceof Error ? err.message : 'Não foi possível importar.');
    } finally {
      this.busy.set(false);
    }
  }
}
