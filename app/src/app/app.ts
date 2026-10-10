import { Component, computed, inject } from '@angular/core';
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
import { NAV_ITEMS } from './core/navigation/nav-items';
import { SettingsService } from './core/settings/settings.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink, RouterLinkActive, IonApp, IonSplitPane, IonMenu, IonContent, IonList, IonListHeader,
    IonMenuToggle, IonItem, IonIcon, IonLabel, IonNote, IonRouterOutlet, IonTabBar, IonTabButton,
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
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);

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
    const url = this.url();
    const tab = this.tabs.find((t) => url.startsWith(t.path));
    return tab?.path ?? '/mais';
  });

  constructor() {
    addIcons({
      homeOutline, calendarOutline, clipboardOutline, barbellOutline, timeOutline, statsChartOutline,
      personOutline, settingsOutline, ellipsisHorizontal, checkmarkCircleOutline, alertCircleOutline,
    });
  }
}
