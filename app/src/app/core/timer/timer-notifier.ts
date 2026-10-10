import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

const NOTIFICATION_ID = 7001;
const CHANNEL_ID = 'timer';

/**
 * Notificação local agendada para o fim do temporizador (só no Android/iOS, não faz nada no browser).
 * Funciona com o ecrã bloqueado e o relógio espelha-a. Qualquer falha é silenciosa: o temporizador
 * dentro da app continua a funcionar sem a notificação.
 */
@Injectable({ providedIn: 'root' })
export class TimerNotifier {
  private readonly native = Capacitor.isNativePlatform();
  private ready: Promise<boolean> | null = null;

  /** Agenda (ou reagenda) o aviso para `at`. */
  async schedule(at: Date, title: string, body: string): Promise<void> {
    if (!this.native) return;
    try {
      if (!(await (this.ready ??= this.prepare()))) return;
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
      await LocalNotifications.schedule({
        notifications: [{ id: NOTIFICATION_ID, title, body, channelId: CHANNEL_ID, schedule: { at }, autoCancel: true }],
      });
    } catch {
      /* sem notificação */
    }
  }

  async cancel(): Promise<void> {
    if (!this.native) return;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    } catch {
      /* ignora */
    }
  }

  /** Pede permissão (uma vez) e cria o canal com som e vibração. */
  private async prepare(): Promise<boolean> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return false;
      await LocalNotifications.createChannel({
        id: CHANNEL_ID, name: 'Temporizador', description: 'Aviso do fim do descanso e da duração',
        importance: 5, visibility: 1, vibration: true,
      });
      return true;
    } catch {
      return false;
    }
  }
}
