import { inject, Injectable } from '@angular/core';
import { METRICS_REPOSITORY, RECOVERY_REPOSITORY } from '../repositories';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../clock';
import { toLocalDate } from '../../core/util/week';
import { lastStimuli, restAdvice, RestAdvice } from '../../core/metrics/recovery';

export interface RecoveryView {
  advice: RestAdvice[];
  /** Dor indicada hoje, por músculo. */
  sorenessToday: Map<string, number>;
}

/** Descanso recomendado por músculo a partir dos treinos dos últimos 7 dias e da dor que indicaste. */
@Injectable({ providedIn: 'root' })
export class RecoveryService {
  private readonly metrics = inject(METRICS_REPOSITORY);
  private readonly recovery = inject(RECOVERY_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);

  async load(): Promise<RecoveryView> {
    const now = this.clock.now();
    const from = new Date(now.getTime() - 8 * 86_400_000);
    const [md, sore] = await Promise.all([
      this.metrics.metricData(from, new Date(now.getTime() + 1000)),
      this.recovery.since(toLocalDate(from)),
    ]);
    const today = toLocalDate(now);
    return {
      advice: restAdvice(lastStimuli(md.sets, md.exercises, now, 7, this.settings.get('secondaryMuscleWeight')()), sore, now),
      sorenessToday: new Map(sore.filter((x) => x.date === today).map((x) => [x.muscle, x.level])),
    };
  }

  async setSoreness(muscle: string, level: number | null): Promise<void> {
    const today = toLocalDate(this.clock.now());
    if (level === null) await this.recovery.clear(today, muscle);
    else await this.recovery.set(today, muscle, level);
  }
}
