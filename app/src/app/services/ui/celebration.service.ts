import { Injectable, signal } from '@angular/core';

/** Festa curta (recorde) mostrada por cima de tudo, na raiz da app (shared/celebration.component.ts). */
@Injectable({ providedIn: 'root' })
export class CelebrationService {
  readonly current = signal<{ title: string; detail: string } | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(title: string, detail: string, ms = 3200): void {
    this.current.set({ title, detail });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.current.set(null), ms);
  }
}
