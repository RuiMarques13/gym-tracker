import { Component, computed, input } from '@angular/core';
import { MUSCLE_LABEL } from '../core/metrics/muscles';

export interface SideMuscles {
  primary: readonly string[];
  secondary: readonly string[];
}

interface Shape {
  id: string;
  d: string;
}

/**
 * Formas do lado esquerdo da figura (x ≤ 50); o lado direito é o espelho. viewBox 0 0 100 205.
 * Desenho esquemático (não anatómico): serve para ver de relance que músculos o exercício trabalha.
 */
const BODY = [
  'M50 26 L34 29 Q27 31 26 40 L28 62 Q31 80 34 92 L35 108 L50 112 Z', // tronco
  'M27 33 Q21 34 20 42 L17 72 L25 74 L29 50 Z', // braço
  'M17 72 L14 106 L21 107 L25 74 Z', // antebraço
  'M50 110 L34 108 Q31 140 33 160 L45 160 Q48 135 50 120 Z', // coxa
  'M33 162 L35 200 L44 200 L45 162 Z', // perna
  'M46 24 L46 30 L50 30 L50 24 Z', // pescoço
];

const FRONT: Shape[] = [
  { id: 'peito', d: 'M50 36 Q38 33 31 40 Q33 52 42 54 Q48 53 50 50 Z' },
  { id: 'deltoide_anterior', d: 'M32 38 Q29 36 27 40 L28 54 Q31 52 33 48 Z' },
  { id: 'deltoide_lateral', d: 'M27 40 Q23 39 22 46 L23 55 Q25 56 28 54 Z' },
  { id: 'biceps', d: 'M27 57 Q22 57 21 63 L20 72 L26 72 L28 61 Z' },
  { id: 'antebracos', d: 'M20 75 L16 104 L21 105 L25 76 Z' },
  { id: 'abdominais', d: 'M50 56 L41 57 Q36 62 35 72 Q35 88 37 98 L50 104 Z' },
  { id: 'quadriceps', d: 'M46 114 L36 111 Q33 135 35 158 L45 158 Q47 138 46 114 Z' },
  { id: 'adutores', d: 'M50 114 L46.5 116 Q47 136 45.5 152 L50 152 Z' },
  { id: 'gemeos', d: 'M35 165 Q34 176 37 187 L42 187 Q44.5 176 44 165 Z' },
];

const BACK: Shape[] = [
  { id: 'costas_dorsais', d: 'M34 47 Q31 62 36 84 L50 90 L50 66 Q40 62 34 47 Z' },
  { id: 'costas_superiores', d: 'M50 29 L38 32 Q35 36 34 42 Q42 52 50 60 Z' },
  { id: 'deltoide_posterior', d: 'M32 38 Q29 36 27 40 L28 54 Q31 52 33 48 Z' },
  { id: 'deltoide_lateral', d: 'M27 40 Q23 39 22 46 L23 55 Q25 56 28 54 Z' },
  { id: 'triceps', d: 'M27 57 Q22 57 21 63 L20 72 L26 72 L28 61 Z' },
  { id: 'antebracos', d: 'M20 75 L16 104 L21 105 L25 76 Z' },
  { id: 'lombares', d: 'M50 92 L40 90 Q39 98 41 106 L50 108 Z' },
  { id: 'gluteos', d: 'M50 108 L36 106 Q33 118 38 128 Q46 130 50 124 Z' },
  { id: 'isquiotibiais', d: 'M49 131 L38 131 Q35 145 36 160 L46 160 Q49 145 49 131 Z' },
  { id: 'gemeos', d: 'M35 165 Q33 176 37 190 L44 190 Q46 176 45 165 Z' },
];

/** Figura frente/costas com os músculos principais (cheio) e secundários (claro, tracejado) destacados. */
@Component({
  selector: 'app-muscle-map',
  template: `
    <div class="wrap" [class.compact]="compact()">
      @for (v of views; track v.name) {
        <figure>
          <svg viewBox="0 0 100 205" role="img" [attr.aria-label]="v.name + ': ' + summary()">
            @for (side of sides; track side; let i = $index) {
              <g [attr.transform]="side">
                @for (d of body; track d) { <path class="body" [attr.d]="d" /> }
                @for (m of v.shapes; track m.id) {
                  <path class="m" [class.p]="isPrimary(m.id, sideOf(v.name, i))" [class.s]="isSecondary(m.id, sideOf(v.name, i))" [attr.d]="m.d" />
                }
              </g>
            }
            <circle class="body" cx="50" cy="14" r="9" />
            @if (bySide()) {
              <text class="lr" x="6" y="200" text-anchor="middle">{{ v.name === 'Frente' ? 'D' : 'E' }}</text>
              <text class="lr" x="94" y="200" text-anchor="middle">{{ v.name === 'Frente' ? 'E' : 'D' }}</text>
            }
          </svg>
          <figcaption>{{ v.name }}</figcaption>
        </figure>
      }
    </div>
    <p class="legend">
      <span class="key p"></span> {{ primaryLabel() }}
      <span class="key s"></span> {{ secondaryLabel() }}
    </p>
    @if (!compact()) { <p class="text">{{ summary() }}</p> }
  `,
  styles: `
    :host { display: block; --mm-p: var(--ion-color-primary); --mm-body: rgba(128,128,128,0.2); }
    .wrap { display: flex; justify-content: center; gap: 12px; }
    figure { margin: 0; text-align: center; flex: 0 1 140px; }
    svg { width: 100%; height: auto; display: block; }
    .wrap.compact figure { flex-basis: 96px; }
    .lr { font-size: 9px; font-weight: 700; fill: var(--ion-color-medium); }
    figcaption { font-size: 0.75rem; color: var(--ion-color-medium); }
    .body { fill: var(--mm-body); }
    .m { fill: rgba(128,128,128,0.1); stroke: rgba(128,128,128,0.35); stroke-width: 0.4; }
    .m.s { fill: var(--mm-p); fill-opacity: 0.38; stroke: var(--mm-p); stroke-width: 0.7; stroke-dasharray: 1.6 1; }
    .m.p { fill: var(--mm-p); fill-opacity: 1; stroke: var(--ion-background-color, #fff); stroke-width: 0.6; stroke-dasharray: none; }
    .legend { display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 0.8rem; margin: 6px 0 2px; color: var(--ion-color-medium); }
    .key { width: 14px; height: 10px; border-radius: 2px; display: inline-block; background: var(--mm-p); margin-left: 8px; }
    .key.s { opacity: 0.38; border: 1px dashed var(--mm-p); box-sizing: border-box; }
    .text { text-align: center; font-size: 0.85rem; margin: 2px 0 0; }
  `,
})
export class MuscleMapComponent {
  /** Ids do spec (ver core/metrics/muscles.ts). */
  readonly primary = input<readonly string[]>([]);
  readonly secondary = input<readonly string[]>([]);
  /**
   * Músculos por lado do corpo (esquerdo/direito), para exercícios unilaterais. Sem isto, os dois lados são iguais.
   * Na frente, o lado direito da pessoa fica à esquerda da imagem; nas costas, ao contrário.
   */
  readonly bySide = input<{ left: SideMuscles; right: SideMuscles } | null>(null);
  readonly primaryLabel = input('Principal');
  readonly secondaryLabel = input('Secundário');
  /** Figuras mais pequenas e sem o texto por baixo (para ecrãs que já têm muito conteúdo). */
  readonly compact = input(false);

  readonly body = BODY;
  readonly sides = ['', 'translate(100 0) scale(-1 1)'];
  readonly views = [
    { name: 'Frente', shapes: FRONT },
    { name: 'Costas', shapes: BACK },
  ];

  /** Lado da pessoa que cada metade da figura mostra (i = 0 é a metade desenhada à esquerda da imagem). */
  sideOf = (view: string, i: number): 'left' | 'right' => ((view === 'Frente') === (i === 0) ? 'right' : 'left');

  private muscles(side?: 'left' | 'right'): SideMuscles {
    const b = this.bySide();
    return b && side ? b[side] : { primary: this.primary(), secondary: this.secondary() };
  }
  isPrimary = (id: string, side?: 'left' | 'right') => this.muscles(side).primary.includes(id);
  isSecondary = (id: string, side?: 'left' | 'right') => !this.isPrimary(id, side) && this.muscles(side).secondary.includes(id);

  readonly summary = computed(() => {
    const names = (l: readonly string[]) => l.map((m) => MUSCLE_LABEL[m] ?? m).join(', ');
    const p = names(this.primary());
    const s = names(this.secondary().filter((m) => !this.primary().includes(m)));
    if (!p && !s) return 'Sem músculos indicados.';
    return [p && `Principais: ${p}.`, s && `Secundários: ${s}.`].filter(Boolean).join(' ');
  });
}
