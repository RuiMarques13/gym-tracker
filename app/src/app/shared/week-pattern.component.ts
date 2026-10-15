import { Component, inject, input, output } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { WEEKDAYS } from '../core/progression/cycle-schedule';

/** Os 7 dias da semana (segunda a domingo) com o treino de cada um; tocar num dia escolhe o treino ou descanso. */
@Component({
  selector: 'app-week-pattern',
  template: `
    <div class="days">
      @for (d of weekdays; track $index; let i = $index) {
        <button type="button" class="day" [class.on]="!!cell(i)" [disabled]="disabled()" (click)="pick(i)">
          <span class="wd">{{ d }}</span>
          <span class="w">{{ cell(i) ? short(cell(i)!) : '—' }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .day { font: inherit; border: 1px solid rgba(128,128,128,.3); border-radius: 8px; padding: 6px 2px; background: none; color: inherit;
      display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; }
    .day.on { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), .12); }
    .wd { font-size: 11px; color: var(--ion-color-medium); }
    .w { font-size: 12px; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; }
  `,
})
export class WeekPatternComponent {
  private readonly alerts = inject(AlertController);
  readonly days = input<(string | null)[] | null>(null);
  readonly workouts = input<{ id: string; name: string }[]>([]);
  readonly disabled = input(false);
  readonly changed = output<(string | null)[]>();
  readonly weekdays = WEEKDAYS;

  cell = (i: number) => this.days()?.[i] ?? null;
  short = (id: string) => this.workouts().find((w) => w.id === id)?.name ?? '?';

  async pick(i: number): Promise<void> {
    const cur = this.cell(i);
    const a = await this.alerts.create({
      header: `${WEEKDAYS[i]}: que treino?`,
      inputs: [
        { type: 'radio', label: 'Descanso', value: '', checked: !cur },
        ...this.workouts().map((w) => ({ type: 'radio' as const, label: w.name, value: w.id, checked: cur === w.id })),
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'OK',
          handler: (v: string) => {
            const next = [...(this.days() ?? Array(7).fill(null))];
            next[i] = v || null;
            this.changed.emit(next);
          },
        },
      ],
    });
    await a.present();
  }
}
