import { Component, computed, effect, inject, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  barbell,
  barbellOutline,
  calendarOutline,
  repeatOutline,
  checkmarkCircleOutline,
  clipboard,
  clipboardOutline,
  bodyOutline,
  bookOutline,
  cameraOutline,
  cloudDoneOutline,
  heartOutline,
  home,
  homeOutline,
  logOutOutline,
  optionsOutline,
  personOutline,
  settingsOutline,
  statsChart,
  statsChartOutline,
  timeOutline,
} from 'ionicons/icons';
import { filter } from 'rxjs';
import { AuthService } from './services/cloud/auth.service';
import { SyncService } from './services/sync/sync.service';
import { DatabaseService } from './services/db/database.service';
import { tabBarVisible } from './core/navigation/tabs';
import { EXERCISE_REPOSITORY, SESSION_REPOSITORY, WORKOUT_REPOSITORY } from './services/repositories';
import { SettingsService } from './services/settings/settings.service';
import { EffortReminder } from './services/timer/effort-reminder';
import { NavStateService } from './services/ui/nav-state.service';
import { TabBarComponent } from './shared/tab-bar.component';
import { TimerBubbleComponent } from './shared/timer-bubble.component';
import { CelebrationComponent } from './shared/celebration.component';
import { CelebrationService } from './services/ui/celebration.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, TabBarComponent, TimerBubbleComponent, CelebrationComponent],
  template: `
    <ion-app>
      <div class="shell" [class.with-tabs]="showTabs()">
        <div class="main" id="main">
          <ion-router-outlet />
        </div>
        @if (showTabs()) { <app-tab-bar [url]="navState.url()" /> }
      </div>
      <app-timer-bubble />
      <app-celebration [title]="party.current()?.title ?? null" [detail]="party.current()?.detail ?? null" />
    </ion-app>
  `,
  styles: `
    .shell { position: absolute; inset: 0; display: flex; flex-direction: column; }
    .main { position: relative; flex: 1; min-height: 0; contain: layout size style; }
    .main ion-router-outlet { position: absolute; inset: 0; }
    /* Com a barra em baixo, a margem de segurança do fundo fica na barra e não nos rodapés dos ecrãs. */
    .with-tabs .main { --ion-safe-area-bottom: 0px; }
    @media (min-width: 992px) {
      .shell { flex-direction: row-reverse; }
      .with-tabs .main { --ion-safe-area-bottom: initial; }
    }
  `,
})
export class App {
  readonly party = inject(CelebrationService);
  protected readonly auth = inject(AuthService);
  protected readonly navState = inject(NavStateService);
  private readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly database = inject(DatabaseService);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  private readonly workouts = inject(WORKOUT_REPOSITORY);
  private readonly sessions = inject(SESSION_REPOSITORY);

  /** Barra de separadores: só com sessão iniciada, fora do treino em curso e com o teclado fechado. */
  readonly showTabs = computed(
    () => this.auth.state() === 'signedIn' && tabBarVisible(this.navState.url()) && !this.navState.keyboardOpen(),
  );

  private onboardChecked = false;

  private readonly effort = inject(EffortReminder);

  constructor() {
    void this.effort.onOpen((id) => void this.router.navigate(['/historico', id]));
    void this.start();
    // A introdução (instalações vazias) só corre depois de entrares ou de escolheres continuar sem conta.
    effect(() => {
      if (this.auth.state() === 'signedIn') untracked(() => void this.maybeOnboard());
      if (this.auth.state() === 'signedOut') untracked(() => void this.requireLogin());
    });
    // Sem sessão não se mexe na app: qualquer navegação volta ao login.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => void this.requireLogin());
    addIcons({
      home, homeOutline, clipboard, clipboardOutline, barbell, barbellOutline, statsChart, statsChartOutline,
      calendarOutline, repeatOutline, timeOutline,
      personOutline, settingsOutline, bodyOutline, bookOutline, cameraOutline, cloudDoneOutline, heartOutline, logOutOutline, optionsOutline, checkmarkCircleOutline, alertCircleOutline,
    });
  }

  /** Ao abrir: sem sessão, vai direto ao ecrã de login. */
  private async start(): Promise<void> {
    await this.auth.init();
    await this.requireLogin();
  }

  private async requireLogin(): Promise<void> {
    if (this.auth.state() !== 'signedOut' || this.router.url.startsWith('/conta')) return;
    await this.router.navigateByUrl('/conta', { replaceUrl: true });
  }

  /**
   * Introdução só em instalações vazias. Quem já tem dados (ou importou uma cópia, que traz o
   * «onboarding.done») nunca a vê: marca-se como feita em silêncio.
   */
  private async maybeOnboard(): Promise<void> {
    if (this.onboardChecked) return;
    this.onboardChecked = true;
    try {
      if (!this.database.status().ready) return;
      // Num dispositivo novo, os dados da conta podem estar a caminho: espera um pouco pelo primeiro sync.
      await this.sync.whenFirstDone(8000);
      if (this.settings.get('onboardingDone')()) return;
      const empty =
        !(await this.exercises.list({ includeArchived: true })).length &&
        !(await this.workouts.list({ includeArchived: true })).length &&
        !(await this.sessions.listFinished({ limit: 1 })).length &&
        !(await this.sessions.getActive());
      if (empty) await this.router.navigateByUrl('/bem-vindo', { replaceUrl: true });
      else await this.settings.set('onboardingDone', true);
    } catch {
      /* a introdução é opcional: nunca bloqueia o arranque */
    }
  }
}
