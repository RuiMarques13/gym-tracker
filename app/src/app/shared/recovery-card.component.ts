import { Component, computed, inject, input, output, resource } from '@angular/core';
import { MUSCLE_LABEL } from '../core/metrics/muscles';
import { formatWait, SORENESS_LABEL } from '../core/metrics/recovery';
import { RecoveryService } from '../services/metrics/recovery.service';

/** Descanso recomendado por músculo treinado nos últimos dias, com a dor de hoje para afinar. */
@Component({
  selector: 'app-recovery-card',
  template: `
    @if (view.isLoading()) {
      <p class="muted">A calcular…</p>
    } @else if (!rows().length) {
      <p class="muted">Sem treinos de musculação nos últimos 7 dias.</p>
    } @else {
      @for (r of rows(); track r.muscle) {
        <div class="row">
          <div class="head">
            <strong>{{ r.label }}</strong>
            <span class="state" [class.wait]="r.status === 'recovering'">{{ r.status === 'ready' ? 'Pronto' : 'Descansa · ' + wait(r.hoursLeft) }}</span>
          </div>
          <p class="why">{{ r.why }}</p>
          <div class="sore" role="group" [attr.aria-label]="'Dor em ' + r.label">
            <span>Dor hoje</span>
            @for (n of levels; track n) {
              <button type="button" [class.on]="r.soreness === n" [attr.aria-pressed]="r.soreness === n" [attr.aria-label]="n + ': ' + soreLabel[n]" (click)="pick(r.muscle, n, r.soreness)">{{ n }}</button>
            }
            @if (r.soreness) { <small>{{ soreLabel[r.soreness] }}</small> }
          </div>
        </div>
      }
      <p class="legal">Estimativa a partir do volume, do esforço (RIR) e da dor. Orientação geral de treino, não aconselhamento médico.</p>
    }
  `,
  styles: `
    .muted { color: var(--ion-color-medium); margin: 0; }
    .row { padding: 10px 0; border-bottom: 1px solid var(--ion-border-color, rgba(128,128,128,0.2)); }
    .row:last-of-type { border-bottom: 0; }
    .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .state { font-size: 0.82rem; font-weight: 600; color: var(--ion-color-primary); }
    .state.wait { color: #b45309; }
    .why { margin: 2px 0 6px; font-size: 0.8rem; color: var(--ion-color-medium); }
    .sore { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--ion-color-medium); flex-wrap: wrap; }
    .sore button { min-width: 30px; height: 30px; border-radius: 15px; border: 1px solid var(--ion-border-color, rgba(128,128,128,0.45)); background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .sore button.on { background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); border-color: var(--ion-color-primary); }
    .legal { color: var(--ion-color-medium); font-size: 0.76rem; margin: 10px 0 0; }
    @media (prefers-color-scheme: dark) { .state.wait { color: #f59e0b; } }
  `,
})
export class RecoveryCardComponent {
  private readonly service = inject(RecoveryService);
  /** Muda para recarregar. */
  readonly refresh = input<number>(0);
  readonly changed = output<void>();

  readonly levels = [1, 2, 3, 4, 5];
  readonly soreLabel = SORENESS_LABEL;
  readonly view = resource({ params: () => this.refresh(), loader: () => this.service.load() });

  readonly rows = computed(() => {
    const v = this.view.value();
    if (!v) return [];
    return v.advice.map((a) => ({
      muscle: a.muscle, label: MUSCLE_LABEL[a.muscle] ?? a.muscle, status: a.status, hoursLeft: a.hoursLeft,
      why: a.reasons.join(' · '), soreness: v.sorenessToday.get(a.muscle) ?? null,
    }));
  });

  wait = formatWait;

  async pick(muscle: string, level: number, current: number | null): Promise<void> {
    await this.service.setSoreness(muscle, current === level ? null : level);
    this.view.reload();
    this.changed.emit();
  }
}
