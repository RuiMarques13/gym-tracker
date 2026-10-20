import { Component, computed, effect, inject, untracked } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonContent,
  IonFooter,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonNote,
  IonRouterOutlet,
  IonSplitPane,
  MenuController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  barbellOutline,
  calendarOutline,
  repeatOutline,
  checkmarkCircleOutline,
  clipboardOutline,
  bodyOutline,
  cameraOutline,
  cloudDoneOutline,
  heartOutline,
  homeOutline,
  logOutOutline,
  optionsOutline,
  personOutline,
  settingsOutline,
  statsChartOutline,
  timeOutline,
} from 'ionicons/icons';
import { filter } from 'rxjs';
import { AuthService } from './services/cloud/auth.service';
import { SyncService } from './services/sync/sync.service';
import { DatabaseService } from './services/db/database.service';
import { resolveNav } from './core/navigation/nav-items';
import { EXERCISE_REPOSITORY, SESSION_REPOSITORY, WORKOUT_REPOSITORY } from './services/repositories';
import { SettingsService } from './services/settings/settings.service';
import { EffortReminder } from './services/timer/effort-reminder';
import { TimerBubbleComponent } from './shared/timer-bubble.component';
import { CelebrationComponent } from './shared/celebration.component';
import { CelebrationService } from './services/ui/celebration.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink, RouterLinkActive, IonApp, IonSplitPane, IonMenu, IonContent, IonList,
    IonMenuToggle, IonItem, IonIcon, IonLabel, IonNote, IonRouterOutlet, IonFooter, TimerBubbleComponent, CelebrationComponent,
  ],
  template: `
    <ion-app>
      <ion-split-pane contentId="main" [when]="auth.state() === 'signedIn' ? 'lg' : false">
        <ion-menu menuId="main-menu" contentId="main" type="overlay" [swipeGesture]="auth.state() === 'signedIn'">
          <ion-content>
            <a class="user" routerLink="/perfil" (click)="closeMenu()">
              <span class="avatar">{{ initials() }}</span>
              <span class="who">
                <strong>{{ displayName() }}</strong>
                <ion-note>{{ auth.email() ?? '' }}</ion-note>
              </span>
            </a>
            <ion-list lines="none" class="nav">
              @for (item of items(); track item.path) {
                <ion-menu-toggle [autoHide]="false">
                  <ion-item [routerLink]="item.path" routerLinkActive="active" [detail]="false" button>
                    <ion-icon slot="start" [name]="item.icon" aria-hidden="true" />
                    <ion-label>{{ item.label }}</ion-label>
                  </ion-item>
                </ion-menu-toggle>
              }
              <ion-menu-toggle [autoHide]="false">
                <ion-item routerLink="/definicoes/menu" routerLinkActive="active" [detail]="false" button class="subtle">
                  <ion-icon slot="start" name="options-outline" aria-hidden="true" />
                  <ion-label>Personalizar menu</ion-label>
                </ion-item>
              </ion-menu-toggle>
            </ion-list>
          </ion-content>
          <ion-footer>
            <ion-list lines="none" class="nav foot">
              <ion-menu-toggle [autoHide]="false">
                <ion-item routerLink="/conta" routerLinkActive="active" [detail]="false" button>
                  <ion-icon slot="start" name="cloud-done-outline" aria-hidden="true" />
                  <ion-label>Conta e sincronização</ion-label>
                </ion-item>
              </ion-menu-toggle>
              <ion-item button [detail]="false" (click)="signOut()">
                <ion-icon slot="start" name="log-out-outline" aria-hidden="true" />
                <ion-label>Terminar sessão</ion-label>
              </ion-item>
            </ion-list>
          </ion-footer>
        </ion-menu>

        <div class="ion-page shell" id="main">
          <ion-router-outlet />
        </div>
      </ion-split-pane>
      <app-timer-bubble />
      <app-celebration [title]="party.current()?.title ?? null" [detail]="party.current()?.detail ?? null" />
    </ion-app>
  `,
  styles: `
    .shell { display: flex; flex-direction: column; }
    .shell ion-router-outlet { position: relative; flex: 1; }
    .user {
      display: flex; gap: 12px; align-items: center; padding: 20px 16px 12px; text-decoration: none; color: inherit;
      padding-top: calc(20px + var(--ion-safe-area-top, 0px));
    }
    .avatar {
      display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 50%;
      background: var(--ion-color-primary); color: var(--ion-color-primary-contrast);
      font-weight: 700; font-size: 1rem; letter-spacing: 0.02em;
    }
    .who { display: flex; flex-direction: column; min-width: 0; }
    .who strong { font-size: 1.02rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who ion-note { font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nav { background: transparent; }
    .nav ion-item { --background: transparent; --border-radius: 10px; margin: 2px 8px; }
    .nav ion-item.active { --background: rgba(var(--ion-color-primary-rgb), 0.12); color: var(--ion-color-primary); }
    .nav ion-item.active ion-icon { color: var(--ion-color-primary); }
    .subtle { opacity: 0.75; font-size: 0.92rem; }
    .foot { border-top: 1px solid var(--ion-border-color, rgba(128, 128, 128, 0.25)); padding: 6px 0; }
  `,
})
export class App {
  readonly party = inject(CelebrationService);
  protected readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly database = inject(DatabaseService);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  private readonly workouts = inject(WORKOUT_REPOSITORY);
  private readonly sessions = inject(SESSION_REPOSITORY);

  private readonly menu = inject(MenuController);
  readonly items = computed(() => resolveNav(this.settings.get('navOrder')(), this.settings.get('navHidden')()));
  readonly displayName = computed(() => this.settings.get('profileName')().trim() || this.auth.email() || 'Gym Tracker');
  readonly initials = computed(() => {
    const src = this.settings.get('profileName')().trim() || this.auth.email() || 'GT';
    const parts = src.split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? 'G') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
  });

  closeMenu(): void {
    void this.menu.close('main-menu');
  }

  async signOut(): Promise<void> {
    await this.menu.close('main-menu');
    await this.auth.signOut();
  }

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
      homeOutline, calendarOutline, repeatOutline, clipboardOutline, barbellOutline, timeOutline, statsChartOutline,
      personOutline, settingsOutline, bodyOutline, cameraOutline, cloudDoneOutline, heartOutline, logOutOutline, optionsOutline, checkmarkCircleOutline, alertCircleOutline,
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
