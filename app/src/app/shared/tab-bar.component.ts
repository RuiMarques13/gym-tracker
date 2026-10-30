import { Component, computed, inject, input } from '@angular/core';
import { IonIcon, NavController } from '@ionic/angular';
import { tabForUrl, tabTarget, TABS, type Tab, type TabId } from '../core/navigation/tabs';
import { NavStateService } from '../services/ui/nav-state.service';

/**
 * Barra dos 4 separadores: em baixo no telemóvel, barra lateral estreita a partir de 992 px.
 * Alvos de toque de 56 px; o separador ativo tem fundo e etiqueta a cheio.
 */
@Component({
  selector: 'app-tab-bar',
  imports: [IonIcon],
  host: { role: 'navigation', 'aria-label': 'Navegação principal' },
  template: `
    @for (tab of tabs; track tab.id) {
      <button type="button" class="tab" [class.on]="active() === tab.id"
        [attr.aria-current]="active() === tab.id ? 'page' : null" (click)="go(tab)">
        <span class="pill"><ion-icon [name]="active() === tab.id ? solid(tab.icon) : tab.icon" aria-hidden="true" /></span>
        <span class="label">{{ tab.label }}</span>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex; justify-content: space-around; flex: none;
      background: var(--gt-surface, var(--ion-background-color));
      border-top: 2px solid var(--gt-line, var(--ion-border-color, rgba(128, 128, 128, 0.25)));
      padding-bottom: var(--ion-safe-area-bottom, 0px);
    }
    .tab {
      flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      background: none; border: 0; padding: 6px 2px; color: var(--ion-color-medium); font: inherit; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .pill { display: grid; place-items: center; width: 56px; height: 30px; border-radius: 15px; transition: background 150ms; }
    .pill ion-icon { font-size: 22px; }
    .label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.01em; }
    .tab.on { color: var(--ion-color-primary); }
    .tab.on .pill { background: rgba(var(--ion-color-primary-rgb), 0.14); }
    .tab:focus-visible { outline: 2px solid var(--ion-color-primary); outline-offset: -4px; border-radius: 12px; }
    @media (prefers-reduced-motion: reduce) { .pill { transition: none; } }

    @media (min-width: 992px) {
      :host {
        flex-direction: column; justify-content: flex-start; gap: 4px; width: 88px; padding: 12px 0;
        padding-top: calc(12px + var(--ion-safe-area-top, 0px)); padding-bottom: 12px;
        border-top: 0; border-right: 2px solid var(--gt-line, var(--ion-border-color, rgba(128, 128, 128, 0.25)));
      }
      .tab { flex: none; min-height: 64px; }
    }
  `,
})
export class TabBarComponent {
  private readonly nav = inject(NavController);
  private readonly state = inject(NavStateService);

  readonly url = input.required<string>();
  readonly tabs = TABS;
  readonly active = computed<TabId | null>(() => tabForUrl(this.url())?.id ?? null);

  solid(icon: string): string {
    return icon.replace(/-outline$/, '');
  }

  go(tab: Tab): void {
    const target = tabTarget(tab, this.url(), this.state.lastSection(tab.id));
    void this.nav.navigateRoot(target, { animated: false });
  }
}
