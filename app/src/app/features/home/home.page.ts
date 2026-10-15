import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { SyncService } from '../../core/sync/sync.service';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonIcon,
  IonHeader,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { home } from 'ionicons/icons';
import { DatabaseService } from '../../core/db/database.service';
import { EXERCISE_REPOSITORY, SESSION_REPOSITORY } from '../../data/repositories/providers';
import { SettingsService } from '../../core/settings/settings.service';
import { CLOCK } from '../../core/util/clock';
import { formatDay, formatTime } from '../history/history-format';
import { HomeWidgetsComponent } from './home-widgets.component';
import { HomeLayoutEditorComponent } from './home-layout-editor.component';
import { SessionLauncher } from '../session/session-launcher';
import { NoticeCardsComponent, SuggestionCardsComponent } from '../../shared/suggestion-cards.component';
import { ProgressionService } from '../../core/progression/progression.service';
import { CycleService, type BlockEndSummary } from '../../core/progression/cycle.service';
import { WEEK_LABEL, type NextBlockProposal } from '../../core/progression/cycles';

@Component({
  selector: 'app-home',
  imports: [NavButtonComponent, 
    RouterLink, IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, HomeWidgetsComponent, HomeLayoutEditorComponent, IonButtons, IonIcon, SuggestionCardsComponent, NoticeCardsComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <app-nav-button slot="start" />
        <ion-title aria-label="Home"><ion-icon name="home" class="home-icon" /></ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="editing.set(!editing())">{{ editing() ? 'Concluir' : 'Editar' }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="page">
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

        @if (deload(); as d) {
          <div class="active deload">
            <div>
              <strong>Semana de descarga</strong>
              <span>Até {{ d.label }}: metade das séries de cada exercício, com a mesma carga.</span>
            </div>
            <ion-button size="small" fill="outline" (click)="endDeload()">Terminar</ion-button>
          </div>
        }
        @if (cycleNow.value(); as cn) {
          <a class="cycle" [routerLink]="['/ciclos', cn.cycle.id]">
            <div>
              <strong>{{ cn.cycle.name }} · {{ cn.pos.block.name }}</strong>
              <span>Semana {{ cn.pos.weekIndex + 1 }} de {{ cn.pos.block.weeks.length }} · {{ weekLabel[cn.pos.week.type].toLowerCase() }}
                @if (cn.pos.week.reps) { · {{ cn.pos.week.reps[0] }}–{{ cn.pos.week.reps[1] }} reps }
                @if (cn.pos.week.sets !== 1) { · séries ×{{ cn.pos.week.sets.toLocaleString('pt-PT') }} }
                @if (cn.pos.week.rir !== null) { · RIR {{ cn.pos.week.rir }} }</span>
              <span>{{ cn.pos.nextDeload ? 'Próxima descarga: semana de ' + day(cn.pos.nextDeload) : 'Sem descarga marcada' }}</span>
            </div>
          </a>
        }
        @if (blockEnd.value(); as be) {
          <div class="block-end">
            <strong>Fim do mesociclo</strong>
            <p>{{ be.text }}</p>
            <div class="opts">
              @for (o of be.options; track o.label) {
                <ion-button size="small" [fill]="o.proposal.kind === be.recommended.kind ? 'solid' : 'outline'" (click)="applyBlockEnd(be, o.proposal)">{{ o.label }}</ion-button>
              }
            </div>
          </div>
        }
        @if (suggestions.value()?.length || notices.value()?.length) {
          <section class="sugg" aria-label="Sugestões">
            <h2>Sugestões</h2>
            <app-notice-cards [notices]="notices.value() ?? []" (changed)="notices.reload()" />
            <app-suggestion-cards [cards]="suggestions.value() ?? []" (changed)="suggestions.reload()" />
          </section>
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
    .home-icon { font-size: 1.45rem; vertical-align: middle; }
    .start { display: flex; justify-content: center; gap: 10px; margin: 12px 0 22px; flex-wrap: wrap; }
    .active { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; margin: 8px 0 22px;
      border-radius: 14px; background: rgba(var(--ion-color-primary-rgb), 0.12); }
    .active strong { display: block; }
    .stale { flex-direction: column; align-items: stretch; background: rgba(var(--ion-color-warning-rgb), 0.18); }
    .stale-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .active span { color: var(--ion-color-medium); font-size: 0.9rem; }
    .deload { background: rgba(var(--ion-color-tertiary-rgb, 128,128,128), 0.14); }
    .sugg { margin: 0 0 18px; }
    .cycle { display: block; text-decoration: none; color: inherit; padding: 12px 16px; margin: 0 0 14px; border-radius: 14px; background: rgba(128,128,128,.1); }
    .cycle strong { display: block; }
    .cycle span { display: block; font-size: 0.85rem; color: var(--ion-color-medium); }
    .block-end { padding: 12px 16px; margin: 0 0 14px; border-radius: 14px; background: rgba(var(--ion-color-primary-rgb), .1); }
    .block-end p { margin: 4px 0 8px; font-size: 14px; }
    .block-end .opts { display: flex; flex-wrap: wrap; gap: 4px; }
    .sugg h2 { font-size: 1rem; margin: 0 0 8px; }
  `,
})
export class HomePage implements ViewWillEnter {
  private readonly progression = inject(ProgressionService);
  private readonly settingsSvc = inject(SettingsService);
  /** Estagnação e fadiga (fase 3): só aparece quando há alguma coisa. */
  readonly suggestions = resource({
    params: () => ({ t: this.tick(), d: this.settingsSvc.get('deloadUntil')() }),
    loader: () => this.progression.cards(),
  });
  private readonly cycles = inject(CycleService);
  readonly weekLabel = WEEK_LABEL;
  readonly cycleNow = resource({ params: () => ({ t: this.tick() }), loader: () => this.cycles.active() });
  readonly blockEnd = resource({ params: () => ({ t: this.tick() }), loader: () => this.cycles.blockEnd() });
  day = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '');
  async applyBlockEnd(be: BlockEndSummary, p: NextBlockProposal): Promise<void> {
    await this.cycles.applyBlockEnd(be, p);
    this.blockEnd.reload();
  }
  /** Ritmo de peso e nível sugerido (fase 4). */
  readonly notices = resource({
    params: () => ({ t: this.tick(), g: this.settingsSvc.get('profileGoal')(), l: this.settingsSvc.get('profileLevel')() }),
    loader: () => this.progression.notices(),
  });
  readonly deload = computed(() => (this.settingsSvc.get('deloadUntil')(), this.tick(), this.progression.deload()));
  async endDeload(): Promise<void> {
    await this.progression.endDeload();
  }
  private readonly database = inject(DatabaseService);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly clock = inject(CLOCK);
  readonly launcher = inject(SessionLauncher);

  constructor() {
    addIcons({ home });
  }

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
