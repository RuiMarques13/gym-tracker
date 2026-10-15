import type { AlertController } from '@ionic/angular';
import type { CycleService, ScheduleConflict } from '../../core/progression/cycle.service';
import type { ConflictChoice } from '../../core/progression/cycles';

const day = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');

/** Pergunta, um a um, o que fazer quando o ciclo e um planeado teu caem no mesmo dia. */
export async function askConflicts(alerts: AlertController, cycles: CycleService, conflicts: ScheduleConflict[]): Promise<void> {
  let left = conflicts;
  while (left.length) {
    const c = left[0];
    const choice = await new Promise<ConflictChoice | null>((resolve) => {
      void alerts.create({
        header: 'Dois treinos no mesmo dia',
        message: `${day(c.day.date)}: já tens «${c.mine.map((m) => m.templateName).join('», «')}» planeado e o ciclo pede «${c.cycleName}».`,
        backdropDismiss: false,
        buttons: [
          { text: 'Fica o meu', handler: () => resolve('mine') },
          { text: 'Fica o do ciclo', handler: () => resolve('cycle') },
          { text: 'Ficam os dois', handler: () => resolve('both') },
        ],
      }).then((a) => a.present());
    });
    if (!choice) return;
    left = await cycles.resolve(c, choice);
  }
}
