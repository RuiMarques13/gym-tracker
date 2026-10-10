import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonContent,
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
  IonTabBar,
  IonTabButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  barbellOutline,
  calendarOutline,
  checkmarkCircleOutline,
  clipboardOutline,
  ellipsisHorizontal,
  homeOutline,
  personOutline,
  settingsOutline,
  statsChartOutline,
  timeOutline,
} from 'ionicons/icons';
import { filter, map } from 'rxjs';
import { AuthService } from './core/cloud/auth.service';
import { DatabaseService } from './core/db/database.service';
import { NAV_ITEMS } from './core/navigation/nav-items';
import { EXERCISE_REPOSITORY, SESSION_REPOSITORY, WORKOUT_REPOSITORY } from './data/repositories/providers';
import { SettingsService } from './core/settings/settings.service';
import { TimerBubbleComponent } from './shared/timer-bubble.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink, RouterLinkActive, IonApp, IonSplitPane, IonMenu, IonContent, IonList, IonListHeader,
    IonMenuToggle, IonItem, IonIcon, IonLabel, IonNote, IonRouterOutlet, IonTabBar, IonTabButton, TimerBubbleComponent,
  ],
  template: `
    <ion-app>
      <ion-split-pane contentId="main" when="lg">
        <!-- Menu lateral: fixo no PC (≥ 992 px). No telemóvel usa-se a barra de separadores. -->
        <ion-menu contentId="main" type="overlay" [swipeGesture]="false">
          <ion-content>
            <ion-list lines="none" class="nav">
              <ion-list-header>
                <div class="brand">
                  <span class="mark">GT</span>
                  <div>
                    <strong>Gym Tracker</strong>
                    <ion-note>Força e mobilidade</ion-note>
                  </div>
                </div>
              </ion-list-header>
              @for (item of nav; track item.path) {
                <ion-menu-toggle [autoHide]="false">
                  <ion-item [routerLink]="item.path" routerLinkActive="active" [detail]="false" button>
                    <ion-icon slot="start" [name]="item.icon" aria-hidden="true" />
                    <ion-label>{{ item.label }}</ion-label>
                  </ion-item>
                </ion-menu-toggle>
              }
            </ion-list>
          </ion-content>
        </ion-menu>

        <div class="ion-page shell" id="main">
          <ion-router-outlet />
          @if (isPhone()) {
            <ion-tab-bar [selectedTab]="selectedTab()">
              @for (item of tabs; track item.path) {
                <ion-tab-button [tab]="item.path" [routerLink]="item.path">
                  <ion-icon [name]="item.icon" aria-hidden="true" />
                  <ion-label>{{ item.label }}</ion-label>
                </ion-tab-button>
              }
              <ion-tab-button tab="/mais" routerLink="/mais">
                <ion-icon name="ellipsis-horizontal" aria-hidden="true" />
                <ion-label>Mais</ion-label>
              </ion-tab-button>
            </ion-tab-bar>
          }
        </div>
      </ion-split-pane>
      <app-timer-bubble />
    </ion-app>
  `,
  styles: `
    .shell { display: flex; flex-direction: column; }
    .shell ion-router-outlet { position: relative; flex: 1; }
    .nav { background: transparent; }
    .nav ion-list-header { padding: 20px 16px 16px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .brand strong { display: block; font-size: 1.05rem; }
    .brand ion-note { font-size: 0.8rem; }
    .mark {
      display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px;
      background: var(--ion-color-primary); color: var(--ion-color-primary-contrast);
      font-weight: 700; font-size: 0.85rem; letter-spacing: 0.02em;
    }
    .nav ion-item { --background: transparent; --border-radius: 10px; margin: 2px 8px; }
    .nav ion-item.active { --background: rgba(var(--ion-color-primary-rgb), 0.12); color: var(--ion-color-primary); }
    .nav ion-item.active ion-icon { color: var(--ion-color-primary); }
  `,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly database = inject(DatabaseService);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  private readonly workouts = inject(WORKOUT_REPOSITORY);
  private readonly sessions = inject(SESSION_REPOSITORY);

  readonly nav = NAV_ITEMS;
  readonly tabs = NAV_ITEMS.filter((i) => i.tab);
  readonly isPhone = computed(() => this.settings.formFactor() === 'phone');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly selectedTab = computed(() => {
    const url = this.url().startsWith('/sessao') ? '/home' : this.url();
    const tab = this.tabs.find((t) => url.startsWith(t.path));
    return tab?.path ?? '/mais';
  });

  private onboardChecked = false;

  constructor() {
    void this.start();
    // A introdução (instalações vazias) só corre depois de entrares ou de escolheres continuar sem conta.
    effect(() => {
      if (this.auth.state() === 'signedIn' || this.auth.skipped()) untracked(() => void this.maybeOnboard());
    });
    addIcons({
      homeOutline, calendarOutline, clipboardOutline, barbellOutline, timeOutline, statsChartOutline,
      personOutline, settingsOutline, ellipsisHorizontal, checkmarkCircleOutline, alertCircleOutline,
    });
  }

  /** Ao abrir: sem sessão (e sem ter escolhido continuar sem conta), vai direto ao ecrã de login. */
  private async start(): Promise<void> {
    await this.auth.init();
    if (this.auth.state() === 'signedOut' && !this.auth.skipped()) {
      await this.router.navigateByUrl('/conta?inicio=1', { replaceUrl: true });
    }
  }

  /**
   * Introdução só em instalações vazias. Quem já tem dados (ou importou uma cópia, que traz o
   * «onboarding.done») nunca a vê: marca-se como feita em silêncio.
   */
  private async maybeOnboard(): Promise<void> {
    if (this.onboardChecked) return;
    this.onboardChecked = true;
    try {
      if (!this.database.status().ready || this.settings.get('onboardingDone')()) return;
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
