import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { SyncService } from '../../core/sync/sync.service';
import { RouterLink } from '@angular/router';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
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
import { SessionLauncher } from '../session/session-launcher';

@Component({
  selector: 'app-home',
  imports: [NavButtonComponent, 
    RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle,
    IonCardSubtitle, IonCardContent, IonList, IonItem, IonLabel, IonNote, IonIcon, IonButton, HomeWidgetsComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar><app-nav-button slot="start" /><ion-title>Home</ion-title></ion-toolbar>
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

        <app-home-widgets [refresh]="tick()" />

        <p class="stats-title">Os teus exercícios</p>
        <div class="stats">
          <a class="stat" routerLink="/exercicios" [queryParams]="{ kind: 'STRENGTH' }">
            <span class="value">{{ counts.value()?.strength ?? '–' }}</span>
            <span class="label">de força</span>
          </a>
          <a class="stat" routerLink="/exercicios" [queryParams]="{ kind: 'MOBILITY' }">
            <span class="value">{{ counts.value()?.mobility ?? '–' }}</span>
            <span class="label">de mobilidade</span>
          </a>
          <a class="stat" routerLink="/exercicios" [queryParams]="{ kind: 'CARDIO' }">
            <span class="value">{{ counts.value()?.cardio ?? '–' }}</span>
            <span class="label">de cardio</span>
          </a>
        </div>

        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>Diagnóstico</ion-card-subtitle>
            <ion-card-title>Base de dados local</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (status().error; as err) {
              <p class="error"><ion-icon name="alert-circle-outline" /> {{ err }}</p>
            }
            <ion-list lines="full">
              <ion-item>
                <ion-label>Estado</ion-label>
                <ion-note slot="end" [class.ok]="status().ready">{{ status().ready ? 'Pronta' : 'A iniciar…' }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>Versão do esquema</ion-label>
                <ion-note slot="end">{{ status().schemaVersion }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>Versão do seed</ion-label>
                <ion-note slot="end">{{ status().seedVersion }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>Dispositivo</ion-label>
                <ion-note slot="end" class="mono">{{ shortDevice() }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>Armazenamento persistente</ion-label>
                <ion-note slot="end">{{ persistentLabel() }}</ion-note>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>
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
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
    .stats-title { font-size: 0.8rem; color: var(--ion-color-medium); margin: 0 0 6px; }
    .stat {
      display: flex; flex-direction: column; gap: 4px; padding: 16px; border-radius: 14px;
      background: var(--ion-background-color-step-50, rgba(127,127,127,0.08)); text-decoration: none; color: inherit;
    }
    .stat .value { font-size: 2rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ion-color-primary); }
    .stat .label { font-size: 0.85rem; color: var(--ion-color-medium); }
    ion-card { margin: 12px 0 0; box-shadow: none; border: 1px solid var(--ion-background-color-step-150, rgba(127,127,127,0.2)); }
    ion-card-content { padding: 0 0 8px; }
    .ok { color: var(--ion-color-success); }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
    .error { color: var(--ion-color-danger); padding: 0 16px; }
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
  private readonly sync = inject(SyncService);
  /** O sync trouxe dados de outro dispositivo: recarrega o que está no ecrã. */
  private readonly onSynced = effect(() => {
    if (this.sync.dataVersion() === 0) return;
    untracked(() => this.ionViewWillEnter());
  });

  ionViewWillEnter(): void {
    this.tick.update((n) => n + 1);
    this.active.reload();
    this.counts.reload();
    this.finishedCount.reload();
  }

  readonly counts = resource({
    loader: async () => {
      const all = await this.exercises.list();
      return {
        strength: all.filter((e) => e.kind === 'STRENGTH').length,
        mobility: all.filter((e) => e.kind === 'MOBILITY').length,
        cardio: all.filter((e) => e.kind === 'CARDIO').length,
      };
    },
  });
}
