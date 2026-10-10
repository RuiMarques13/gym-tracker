import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { SyncService } from '../../core/sync/sync.service';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular';
import { DatabaseService } from '../../core/db/database.service';
import { EXERCISE_REPOSITORY, SESSION_REPOSITORY } from '../../data/repositories/providers';
import { SettingsService } from '../../core/settings/settings.service';
import { CLOCK } from '../../core/util/clock';
import { formatDay, formatTime } from '../history/history-format';
import { HomeWidgetsComponent } from './home-widgets.component';
import { HomeLayoutEditorComponent } from './home-layout-editor.component';
import { SessionLauncher } from '../session/session-launcher';

@Component({
  selector: 'app-home',
  imports: [NavButtonComponent, 
    RouterLink, IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, HomeWidgetsComponent, HomeLayoutEditorComponent, IonButtons,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <app-nav-button slot="start" />
        <ion-title>Home</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="editing.set(!editing())">{{ editing() ? 'Concluir' : 'Editar' }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="page">
        <h1 class="greeting">Bom treino.</h1>
        @if (backupDue()) {
          <div class="active backup">
            <div>
              <strong>Faz uma cópia de segurança</strong>
              <span>{{ lastExport() ? 'A última foi há mais de 2 semanas.' : 'Ainda não exportaste os teus dados.' }} Os dados vivem só neste dispositivo.</span>
            </div>
            <ion-button size="small" routerLink="/definicoes">Exportar</ion-button>
          </div>
        }
        @if (stale(); as st) {
          <div class="active stale">
            <div>
              <strong>Esqueceste-te de terminar?</strong>
              <span>«{{ st.name }}» está aberta desde {{ st.since }}@if (st.last) { ; a última série foi às {{ st.lastTime }} }.</span>
            </div>
            <div class="stale-actions">
              @if (st.last) { <ion-button size="small" (click)="endAt(st.id, st.last)">Terminar às {{ st.lastTime }}</ion-button> }
              <ion-button size="small" fill="outline" routerLink="/sessao">Continuar</ion-button>
            </div>
          </div>
        } @else if (active.value(); as a) {
          <div class="active">
            <div>
              <strong>Sessão em curso</strong>
              <span>{{ a.templateName ?? 'Sessão livre' }}</span>
            </div>
            <ion-button routerLink="/sessao">Continuar</ion-button>
          </div>
        } @else {
          <div class="start">
            <ion-button (click)="launcher.start(null)">Sessão livre</ion-button>
            <ion-button fill="outline" routerLink="/treinos">Escolher um treino</ion-button>
          </div>
        }

        @if (editing()) {
          <app-home-layout-editor />
        } @else {
          <app-home-widgets [refresh]="tick()" />
        }

      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    .greeting { font-size: 1.9rem; font-weight: 700; margin: 8px 0 4px; letter-spacing: -0.01em; }
    .start { display: flex; gap: 10px; margin: 8px 0 22px; flex-wrap: wrap; }
    .active { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; margin: 8px 0 22px;
      border-radius: 14px; background: rgba(var(--ion-color-primary-rgb), 0.12); }
    .active strong { display: block; }
    .stale { flex-direction: column; align-items: stretch; background: rgba(var(--ion-color-warning-rgb), 0.18); }
    .stale-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .active span { color: var(--ion-color-medium); font-size: 0.9rem; }
  `,
})
export class HomePage implements ViewWillEnter {
  private readonly database = inject(DatabaseService);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly clock = inject(CLOCK);
  readonly launcher = inject(SessionLauncher);

  readonly status = this.database.status;
  readonly shortDevice = computed(() => this.status().deviceId?.slice(0, 8) ?? '–');
  readonly persistentLabel = computed(() => {
    const p = this.status().persistentStorage;
    return p === null ? 'n/d (nativo)' : p ? 'Sim' : 'Não concedido';
  });

  readonly active = resource({ loader: () => this.sessions.getActive() });
  /** Sessão aberta há mais de 4 h desde a última atividade: propõe terminar na última série. */
  readonly stale = computed(() => {
    const a = this.active.value();
    if (!a) return null;
    const ref = a.lastActivityAt ?? a.startedAt;
    if (this.clock.now().getTime() - Date.parse(ref) < 4 * 3600_000) return null;
    return {
      id: a.id, name: a.templateName ?? 'Sessão livre', last: a.lastActivityAt,
      since: formatDay(a.startedAt) + ', ' + formatTime(a.startedAt), lastTime: a.lastActivityAt ? formatTime(a.lastActivityAt) : '',
    };
  });

  readonly lastExport = inject(SettingsService).get('lastExportAt');
  readonly finishedCount = resource({ loader: async () => (await this.sessions.listFinished({ limit: 1 })).length });
  /** Lembrete: há sessões registadas e a última exportação foi há mais de 14 dias (ou nunca). */
  readonly backupDue = computed(() => {
    if (!this.finishedCount.value()) return false;
    const last = this.lastExport();
    return !last || this.clock.now().getTime() - Date.parse(last) > 14 * 86400_000;
  });

  async endAt(id: string, endedAt: string): Promise<void> {
    await this.sessions.finish(id, { endedAt });
    this.active.reload();
  }

  readonly tick = signal(0);
  readonly editing = signal(false);
  private readonly sync = inject(SyncService);
  /** O sync trouxe dados de outro dispositivo: recarrega o que está no ecrã. */
  private readonly onSynced = effect(() => {
    if (this.sync.dataVersion() === 0) return;
    untracked(() => this.ionViewWillEnter());
  });

  ionViewWillEnter(): void {
    this.tick.update((n) => n + 1);
    this.active.reload();
    this.finishedCount.reload();
  }

}
