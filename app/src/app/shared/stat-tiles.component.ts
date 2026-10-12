import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface StatTile {
  label: string;
  value: string;
  unit?: string;
  /** Cor do título (segue a paleta escolhida). */
  tone?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'danger' | 'medium';
  /** Linha pequena por baixo, p. ex. «estimado». */
  hint?: string;
}

/** Quadrados de números grandes, ao estilo do resumo de treino do Samsung Health. */
@Component({
  selector: 'app-stat-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" [class.big]="size() === 'big'" [class.compact]="size() === 'compact'" [style.grid-template-columns]="'repeat(' + cols() + ', minmax(0, 1fr))'">
      @for (t of tiles(); track t.label) {
        <div class="tile">
          <span class="label" [style.color]="'var(--ion-color-' + (t.tone ?? 'primary') + ')'">{{ t.label }}</span>
          <span class="value">{{ t.value }}@if (t.unit) { <small>{{ t.unit }}</small> }</span>
          @if (t.hint) { <span class="hint">{{ t.hint }}</span> }
        </div>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; gap: 10px; }
    .tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 92px; padding: 12px 8px;
      border-radius: 18px; text-align: center; background: var(--ion-card-background, var(--ion-item-background, #fff));
      border: 1px solid var(--ion-border-color, rgba(127, 127, 127, 0.28)); }
    .label { font-size: 0.82rem; font-weight: 600; line-height: 1.15; }
    .value { font-size: 1.65rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .value small { margin-left: 4px; font-size: 0.78rem; font-weight: 600; color: var(--ion-color-medium); }
    .hint { font-size: 0.7rem; color: var(--ion-color-medium); }
    .compact { gap: 8px; }
    .compact .tile { min-height: 70px; padding: 8px 4px; border-radius: 14px; gap: 2px; }
    .compact .label { font-size: 0.7rem; }
    .compact .value { font-size: 1.2rem; }
    .compact .value small { font-size: 0.65rem; margin-left: 2px; }
    .big .tile { min-height: 112px; }
    .big .value { font-size: 2rem; }
  `,
})
export class StatTilesComponent {
  readonly tiles = input.required<readonly StatTile[]>();
  readonly size = input<'normal' | 'big' | 'compact'>('normal');
  readonly cols = input(2);
}
