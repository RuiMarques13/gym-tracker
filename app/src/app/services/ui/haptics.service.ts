import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SettingsService } from '../settings/settings.service';

/**
 * Vibração curta como resposta a um toque. Android: plugin nativo. Browser: navigator.vibrate quando existe
 * (Chrome no Android); noutros browsers não faz nada e a app funciona igual. Desliga-se em Definições.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly settings = inject(SettingsService);

  /** Série registada. */
  tap(): void {
    this.run(() => Haptics.impact({ style: ImpactStyle.Medium }), 18);
  }

  /** Recorde ou treino terminado. */
  success(): void {
    this.run(() => Haptics.notification({ type: NotificationType.Success }), [30, 60, 40]);
  }

  private run(native: () => Promise<void>, web: number | number[]): void {
    if (!this.settings.get('haptics')()) return;
    try {
      if (Capacitor.isNativePlatform()) void native().catch(() => undefined);
      else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(web);
    } catch {
      // sem vibração: não faz mal
    }
  }
}
