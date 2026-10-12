import { inject, Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { toastHtml } from './toast-text';
import { alertCircle, checkmarkCircle, informationCircle } from 'ionicons/icons';

export type ToastKind = 'success' | 'error' | 'info';

const ICON: Record<ToastKind, string> = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' };

/**
 * Avisos de sucesso, erro e informação: ao centro do ecrã, com um verde suave (ou vermelho/neutro) e uma leve
 * flutuação (o estilo está em styles.scss, classe gt-toast). O texto entre «» passa a negrito.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts = inject(ToastController);

  constructor() {
    addIcons({ checkmarkCircle, alertCircle, informationCircle });
  }

  success(message: string, duration = 2200): Promise<void> {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration = 3200): Promise<void> {
    return this.show(message, 'error', duration);
  }

  info(message: string, duration = 2200): Promise<void> {
    return this.show(message, 'info', duration);
  }

  async show(message: string, kind: ToastKind = 'info', duration = 2200): Promise<void> {
    const t = await this.toasts.create({
      message: toastHtml(message),
      icon: ICON[kind],
      position: 'middle',
      duration,
      cssClass: ['gt-toast', `gt-toast-${kind}`],
    });
    await t.present();
  }
}
