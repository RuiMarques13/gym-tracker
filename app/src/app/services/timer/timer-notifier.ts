import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

const NOTIFICATION_ID = 7001;
const CHANNEL_ID = 'timer';
/** Ids das notificações das trocas de fase (Tabata, EMOM, intervalos). */
const MANY_BASE = 7100;
const MANY_MAX = 120;

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

  /** Várias notificações (trocas de fase de um treino por tempo). Substitui as anteriores desta série. */
  async scheduleMany(items: { at: Date; title: string; body: string }[]): Promise<void> {
    if (!this.native) return;
    try {
      if (!(await (this.ready ??= this.prepare()))) return;
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await this.cancelMany();
      const future = items.filter((x) => x.at.getTime() > Date.now()).slice(0, MANY_MAX);
      if (!future.length) return;
      await LocalNotifications.schedule({
        notifications: future.map((x, i) => ({ id: MANY_BASE + i, title: x.title, body: x.body, channelId: CHANNEL_ID, schedule: { at: x.at }, autoCancel: true })),
      });
    } catch {
      /* sem notificação */
    }
  }

  async cancelMany(): Promise<void> {
    if (!this.native) return;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: Array.from({ length: MANY_MAX }, (_, i) => ({ id: MANY_BASE + i })) });
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
