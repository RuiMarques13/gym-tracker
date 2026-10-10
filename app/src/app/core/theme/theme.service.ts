import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';
import { SettingsService } from '../settings/settings.service';

/** Aplica o tema (definição ui.theme) com a paleta escura por classe do Ionic. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly settings = inject(SettingsService);
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = signal(false);

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
      this.document.documentElement.classList.toggle('ion-palette-dark', dark);
    });
  }
}
