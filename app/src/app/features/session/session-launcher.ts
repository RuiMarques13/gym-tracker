import { inject, Injectable } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { SESSION_REPOSITORY } from '../../data/repositories/providers';

/** Começa (ou retoma) uma sessão e abre o ecrã da sessão. Partilhado por Treinos e Home. */
@Injectable({ providedIn: 'root' })
export class SessionLauncher {
  private readonly repo = inject(SESSION_REPOSITORY);
  private readonly nav = inject(NavController);
  private readonly alerts = inject(AlertController);

  async start(templateId: string | null, scheduledId: string | null = null): Promise<void> {
    const active = await this.repo.getActive();
    if (active) {
      const alert = await this.alerts.create({
        header: 'Já tens uma sessão em curso',
        message: `«${active.templateName ?? 'Sessão livre'}» ainda não terminou. Termina-a ou descarta-a antes de começar outra.`,
        buttons: [
          { text: 'Agora não', role: 'cancel' },
          { text: 'Continuar a sessão', handler: () => void this.nav.navigateForward('/sessao') },
        ],
      });
      await alert.present();
      return;
    }
    await this.repo.start({ templateId, scheduledId });
    await this.nav.navigateForward('/sessao');
  }
}
