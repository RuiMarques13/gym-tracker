import { inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ToastController } from '@ionic/angular';
import { filter } from 'rxjs';

/**
 * Avisa quando há uma versão nova da app (PWA). O service worker já a descarregou em segundo
 * plano; só se aplica quando a pessoa carrega em «Atualizar», para não recarregar a meio de uma série.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly sw = inject(SwUpdate);
  private readonly toasts = inject(ToastController);
  private started = false;

  start(): void {
    if (this.started || !this.sw.isEnabled) return;
    this.started = true;
    this.sw.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => void this.announce());
    // Procura atualizações ao voltar à app (a instalada raramente é reaberta de raiz).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.sw.checkForUpdate().catch(() => undefined);
    });
  }

  private async announce(): Promise<void> {
    const toast = await this.toasts.create({
      message: 'Há uma nova versão da app.',
      position: 'bottom',
      duration: 0,
      buttons: [
        { text: 'Mais tarde', role: 'cancel' },
        {
          text: 'Atualizar',
          handler: () => {
            this.sw.activateUpdate().finally(() => document.location.reload());
          },
        },
      ],
    });
    await toast.present();
  }
}
