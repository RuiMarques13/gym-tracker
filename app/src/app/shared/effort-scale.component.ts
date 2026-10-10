import { Component, computed, input, output } from '@angular/core';
import { EFFORT_LEVELS } from './effort-scale';

/** Escala 0–10 para o esforço da sessão, com o significado do valor escolhido. Tocar de novo limpa. */
@Component({
  selector: 'app-effort-scale',
  template: `
    <div class="label">Esforço da sessão <span class="opt">(opcional)</span></div>
    <div class="row" role="radiogroup" aria-label="Esforço da sessão, de 0 a 10">
      @for (l of levels; track l.value) {
        <button type="button" role="radio" class="chip" [class.on]="value() === l.value" [attr.aria-checked]="value() === l.value"
          [attr.aria-label]="l.value + ' — ' + l.label" (click)="pick(l.value)">{{ l.value }}</button>
      }
    </div>
    <p class="meaning" aria-live="polite">
      @if (current(); as c) { <strong>{{ c.label }}</strong> · {{ c.hint }} } @else { Toca num número. Como foi a sessão no geral? }
    </p>
  `,
  styles: `
    .label { font-size: 0.8rem; color: var(--ion-color-medium); margin-bottom: 6px; }
    .opt { opacity: 0.8; }
    .row { display: grid; grid-template-columns: repeat(11, 1fr); gap: 4px; }
    .chip { min-width: 0; height: 40px; border-radius: 10px; border: 1px solid var(--ion-color-medium); background: transparent;
      color: inherit; font: inherit; font-weight: 600; padding: 0; }
    .chip.on { background: var(--ion-color-primary); border-color: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .meaning { margin: 8px 0 0; font-size: 0.9rem; min-height: 1.4em; color: var(--ion-color-medium); }
    .meaning strong { color: inherit; }
  `,
})
export class EffortScaleComponent {
  /** Valor como texto (como o formulário o guarda): '' = sem valor. */
  readonly text = input.required<string>();
  readonly changed = output<string>();
  readonly levels = EFFORT_LEVELS;
  readonly value = computed(() => (this.text() === '' ? null : Math.round(Number(this.text()))));
  readonly current = computed(() => EFFORT_LEVELS.find((l) => l.value === this.value()) ?? null);

  pick(v: number): void {
    this.changed.emit(this.value() === v ? '' : String(v));
  }
}
