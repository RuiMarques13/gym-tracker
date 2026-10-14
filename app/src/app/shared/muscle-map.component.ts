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
 * Desenho simplificado mas com a forma de cada músculo, para se perceber de relance o que o exercício trabalha.
 */
const BODY = [
  'M50 23 L46 23 Q46 28 40 30 L33 31 Q24 32 22 40 L19 56 Q18 64 19 72 L16 80 Q13 92 13 106 L14 112 L19 112 L21 104 Q24 90 26 80 Q28 70 29 60 L32 56 Q34 70 35 84 Q35 92 33 100 Q31 110 32 128 Q33 146 35 160 Q34 172 35 184 L36 198 L43 200 L44 186 Q45 172 45 162 Q48 140 49 120 L50 116 Z',
];

const FRONT: Shape[] = [
  { id: 'costas_superiores', d: 'M46.5 25 Q46 29 41 31 L35.5 32 Q41 33.5 46 32.5 Q48.5 31 49.5 29 L49.5 25 Z' },
  { id: 'deltoide_anterior', d: 'M35 32 Q29.5 32 27.5 37 Q27 44 28.5 50 Q31.5 46.5 33.5 42 Q34.5 37 36.5 34 Z' },
  { id: 'deltoide_lateral', d: 'M28 33.5 Q22.5 35 21.5 42 Q21 49 22.5 54 Q25.5 52.5 28 50 Q26.5 43 27.5 37 Z' },
  { id: 'peito', d: 'M49.5 34 Q43 32.5 37.5 34 Q34 37.5 32 44 Q32.5 51 38 54.5 Q44.5 56 49.5 52.5 Z' },
  { id: 'biceps', d: 'M28 53 Q23.5 54 21.5 60 Q20.5 66 21 71.5 Q24 72.5 26.5 71 Q28.5 64 28.5 57 Z' },
  { id: 'antebracos', d: 'M21 74 Q16.5 80 15 92 L14.5 105 L19.5 105.5 Q21.5 94 24.5 83 Q26 77 25 74 Z' },
  { id: 'obliquos', d: 'M42.5 57 Q37 58 35 63 Q34 74 35.5 85 Q37 95 42.5 101 Q41.5 92 41.5 84 Q41.5 70 42.5 57 Z' },
  { id: 'abdominais', d: 'M49.5 56.5 L43.5 57 Q42 70 42.2 84 Q42.6 95 45 101 L49.5 104 Z' },
  { id: 'gluteo_medio', d: 'M35.5 98 Q33 103 32.8 111 Q34.5 112 37 111.5 Q37.5 104.5 39.5 101 Z' },
  { id: 'quadriceps', d: 'M46.5 113 Q41 110.5 37.5 112.5 Q33.5 126 34.3 142 Q35 152 38 158.5 Q41.5 160 45 158.5 Q47 148 47.6 132 Q48 121 46.5 113 Z' },
  { id: 'adutores', d: 'M49.5 113 L47 114 Q48.8 124 48 139 Q47.6 145 46.8 150 Q48.5 149 49.5 145 Z' },
  { id: 'tibial', d: 'M37.5 165 Q35.5 176 36.3 188 Q37.5 193 39 196 Q40 186 40.3 176 Q40.5 170 40 165 Z' },
  { id: 'gemeos', d: 'M41.5 165.5 Q44.3 171 44.4 181 Q43.5 187 42.4 190 Q41.2 181 41 172 Z' },
];

const BACK: Shape[] = [
  { id: 'costas_superiores', d: 'M49.5 24 L46.5 24 Q46 29 40 31 L34.5 33 Q35 37 37.5 38.5 Q43 43 46 51 Q48 58 49.5 63 Z' },
  { id: 'deltoide_posterior', d: 'M35 33.5 Q29.5 33 27.5 37.5 Q27 44 28.5 50 Q31.5 46.5 33.5 42 Q34.5 38 36.5 36 Z' },
  { id: 'deltoide_lateral', d: 'M28 33.5 Q22.5 35 21.5 42 Q21 49 22.5 54 Q25.5 52.5 28 50 Q26.5 43 27.5 37 Z' },
  { id: 'triceps', d: 'M28 52.5 Q23 53.5 21.3 60 Q20.4 66 21 71.5 Q24 72.5 26.5 71 Q28.6 64 28.5 56 Z' },
  { id: 'antebracos', d: 'M21 74 Q16.5 80 15 92 L14.5 105 L19.5 105.5 Q21.5 94 24.5 83 Q26 77 25 74 Z' },
  { id: 'obliquos', d: 'M35 72 Q34.3 82 36 91 Q38.5 97 42.5 99.5 L42.5 92 Q37 85 35 72 Z' },
  { id: 'costas_dorsais', d: 'M37.5 40 Q33.5 50 34.3 63 Q35.5 78 42 91 L45.5 89 Q44.3 76 45.6 62 Q46 55 45 51 Q42 44 37.5 40 Z' },
  { id: 'lombares', d: 'M49.5 64 L46.6 62 Q45.2 75 45.6 88 Q46 98 46.8 104 L49.5 106 Z' },
  { id: 'gluteo_medio', d: 'M38 99.5 Q34 101 33.5 107 Q34.5 111 38 111 Q43 108 46.5 104 Q42.5 100.5 38 99.5 Z' },
  { id: 'gluteos', d: 'M49.5 106.5 Q45 105.5 40.5 109.5 Q35.5 112 35 119.5 Q35.8 127.5 42 130 Q47 130.5 49.5 127 Z' },
  { id: 'isquiotibiais', d: 'M48.6 132 Q43 131 38.2 132.5 Q35.2 145 36 158 Q40.5 160.5 45.5 158 Q48.4 146 48.6 132 Z' },
  { id: 'gemeos', d: 'M36.3 165 Q33.5 175 36.5 187 Q39.5 190 42.5 188 Q45.8 177 44.6 165 Q40.5 163 36.3 165 Z' },
];

/** Linhas de desenho (sem cor própria): separações dentro dos músculos, só para dar forma. */
const FRONT_LINES = [
  'M43.5 66 L49.5 66', 'M43.2 75 L49.5 75', 'M43 84.5 L49.5 84.5',
  'M38 54.5 Q44 53 49.5 49',
  'M40.5 113 Q39.5 132 41.5 156', 'M44 120 Q43.5 140 44.5 157',
  'M42.5 128 Q45 137 46.5 150',
];
const BACK_LINES = [
  'M49.5 63 L49.5 106',
  'M40.5 165 Q40 177 39.8 187',
  'M42.6 133 Q42.4 146 41.5 158',
  'M40 50 Q42 47 46 48',
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
                @for (d of v.lines; track d) { <path class="line" [attr.d]="d" /> }
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
    .line { fill: none; stroke: rgba(128,128,128,0.4); stroke-width: 0.35; stroke-linecap: round; pointer-events: none; }
    .m.p { fill: var(--mm-p); fill-opacity: 1; stroke: var(--ion-background-color, #fff); stroke-width: 0.6; stroke-dasharray: none; }
    .legend { display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 0.8rem; margin: 6px 0 2px; color: var(--ion-color-medium); }
    .key { width: 14px; height: 10px; border-radius: 2px; display: inline-block; background: var(--mm-p); margin-left: 8px; }
    .key.s { opacity: 0.38; border: 1px dashed var(--mm-p); box-sizing: border-box; }
    .text { text-align: center; font-size: 0.85rem; margin: 2px 0 0; }
  `,
})
export class MuscleMapComponent {
  /** Zonas do boneco: ids do spec mais oblíquos, glúteo médio e tibial (ver figureOfKeys em core/metrics/muscles.ts). */
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
    { name: 'Frente', shapes: FRONT, lines: FRONT_LINES },
    { name: 'Costas', shapes: BACK, lines: BACK_LINES },
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
