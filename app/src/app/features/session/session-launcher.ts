import { inject, Injectable } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { SESSION_REPOSITORY } from '../../data/repositories/providers';
import { toastHtml } from '../../core/ui/toast-text';

import { BLOCK_ORDER } from '../../data/models/workout';
import type { Session, SessionExercise } from '../../data/models/session';

/** O primeiro exercício pela ordem do treino (blocos e posição). */
export function firstExercise(s: Session | null | undefined): SessionExercise | null {
  if (!s) return null;
  for (const block of BLOCK_ORDER) {
    const inBlock = s.exercises.filter((e) => e.block === block).sort((a, b) => a.position - b.position);
    if (inBlock.length) return inBlock[0];
  }
  return null;
}

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
        message: toastHtml(`«${active.templateName ?? 'Sessão livre'}» ainda não terminou. Termina-a ou descarta-a antes de começar outra.`),
        buttons: [
          { text: 'Agora não', role: 'cancel' },
          { text: 'Continuar a sessão', handler: () => void this.nav.navigateForward('/sessao') },
        ],
      });
      await alert.present();
      return;
    }
    const started = await this.repo.start({ templateId, scheduledId });
    await this.nav.navigateForward('/sessao');
    // Treino que abre com cardio: a atividade arranca já (contagem de 5 s), sem passar pelo menu.
    const first = firstExercise(started);
    if (first?.kind === 'CARDIO') await this.nav.navigateForward(['/sessao/cardio', first.id]);
  }
}
