import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { cleanPath, sectionForUrl, type TabId } from '../../core/navigation/tabs';

/**
 * Estado da navegação principal: o URL atual, a última secção usada em cada separador
 * (para o separador reabrir onde estavas) e se o teclado está aberto (a barra esconde-se).
 * A memória das secções vive só enquanto a app está aberta.
 */
@Injectable({ providedIn: 'root' })
export class NavStateService {
  private readonly router = inject(Router);
  private readonly sections = new Map<TabId, string>();

  readonly url = signal(this.router.url);
  readonly keyboardOpen = signal(false);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      this.url.set(url);
      const hit = sectionForUrl(url);
      // Só as raízes das secções ficam na memória; um ecrã de detalhe não muda a secção do separador.
      if (hit && hit.section.path === cleanPath(url)) this.sections.set(hit.tab.id, hit.section.path);
    });
    // O Ionic avisa quando o teclado abre e fecha (Capacitor e browser no telemóvel).
    window.addEventListener('ionKeyboardDidShow', () => this.keyboardOpen.set(true));
    window.addEventListener('ionKeyboardDidHide', () => this.keyboardOpen.set(false));
  }

  lastSection(tab: TabId): string | undefined {
    return this.sections.get(tab);
  }
}
