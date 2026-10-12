import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';
import { PALETTES, PaletteId } from './palettes';
import { SettingsService } from '../settings/settings.service';

const THEME_COLOR = Object.fromEntries(PALETTES.map((p) => [p.id, p.light[0]])) as Record<PaletteId, string>;

/** Aplica o tema (ui.theme: claro/escuro, por classe do Ionic) e a paleta de cores (ui.palette: atributo data-palette). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly settings = inject(SettingsService);
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = signal(false);
  /** O tema escuro está ativo (por escolha ou porque o sistema está em escuro). */
  readonly isDark = signal(false);

  start(): void {
    const media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (media) {
      this.systemDark.set(media.matches);
      media.addEventListener('change', (e) => this.systemDark.set(e.matches));
    }
  }

  constructor() {
    effect(() => {
      const pref = this.settings.get('theme')();
      const dark = pref === 'dark' || (pref === 'system' && this.systemDark());
      this.isDark.set(dark);
      this.document.documentElement.classList.toggle('ion-palette-dark', dark);
    });
    effect(() => {
      const palette = this.settings.get('palette')();
      this.document.documentElement.setAttribute('data-palette', palette);
      // a barra do sistema (PWA e Android) acompanha a cor principal
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[palette]);
    });
  }
}
