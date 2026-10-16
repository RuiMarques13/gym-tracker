import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

const NOTIFICATION_ID = 7002;
const CHANNEL_ID = 'effort';
/** Quanto tempo depois do fim do treino se pergunta o esforço (sRPE costuma pedir-se ~30 min depois). */
export const EFFORT_DELAY_MIN = 30;

/**
 * Lembrete para registar o esforço da sessão (sRPE) cerca de 30 minutos depois de a terminares sem o indicares.
 * Só no Android/iOS; qualquer falha é silenciosa. Tocar na notificação abre a sessão (ver `onOpen`).
 */
@Injectable({ providedIn: 'root' })
export class EffortReminder {
  private readonly native = Capacitor.isNativePlatform();
  private ready: Promise<boolean> | null = null;

  async schedule(sessionId: string, after = new Date(Date.now() + EFFORT_DELAY_MIN * 60_000)): Promise<void> {
    if (!this.native) return;
    try {
      if (!(await (this.ready ??= this.prepare()))) return;
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
      await LocalNotifications.schedule({
        notifications: [{
          id: NOTIFICATION_ID, title: 'Como foi o treino?', body: 'Regista o esforço da sessão (0–10).',
          channelId: CHANNEL_ID, schedule: { at: after, allowWhileIdle: true }, autoCancel: true, extra: { sessionId },
        }],
      });
    } catch {
      /* sem lembrete */
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

  /** Chama `open(sessionId)` quando o utilizador toca no lembrete. */
  async onOpen(open: (sessionId: string) => void): Promise<void> {
    if (!this.native) return;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
        const id = e.notification.extra?.sessionId;
        if (e.notification.id === NOTIFICATION_ID && typeof id === 'string') open(id);
      });
    } catch {
      /* ignora */
    }
  }

  private async prepare(): Promise<boolean> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return false;
      await LocalNotifications.createChannel({
        id: CHANNEL_ID, name: 'Esforço da sessão', description: 'Lembrete para registar o esforço depois do treino',
        importance: 3, visibility: 1, vibration: true,
      });
      return true;
    } catch {
      return false;
    }
  }
}
