import { Component, computed, input, output, signal } from '@angular/core';
import { PORTION, type PortionId } from '../core/anatomy/portions';
import type { Confidence, PortionInfo } from '../core/anatomy/profiles';
import { SOURCES, type Measure, type Source } from '../core/anatomy/sources';

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
  { id: 'trap_upper', d: 'M46.5 25 Q46 29 41 31 L35.5 32 Q41 33.5 46 32.5 Q48.5 31 49.5 29 L49.5 25 Z' },
  { id: 'delt_front', d: 'M35 32 Q29.5 32 27.5 37 Q27 44 28.5 50 Q31.5 46.5 33.5 42 Q34.5 37 36.5 34 Z' },
  { id: 'delt_side', d: 'M28 33.5 Q22.5 35 21.5 42 Q21 49 22.5 54 Q25.5 52.5 28 50 Q26.5 43 27.5 37 Z' },
  { id: 'pec_clavicular', d: 'M49.5 34 Q43 32.5 37.5 34 Q35 36.5 33.6 39.5 Q41 38.8 49.5 39.8 Z' },
  { id: 'pec_sternal', d: 'M49.5 40.5 Q41 39.5 33.3 40.3 Q32.2 42.5 32 44.5 Q32.5 49 36 51 Q43 49.8 49.5 48.8 Z' },
  { id: 'pec_costal', d: 'M49.5 49.5 Q43 50.5 36.6 51.6 Q37.2 53.6 38 54.5 Q44.5 56 49.5 52.5 Z' },
  { id: 'serratus', d: 'M38.6 55.4 Q35.2 56.2 34.5 60 Q34.6 63 35.4 65 Q38.2 63.2 42.2 61.4 Q42.6 58.5 42.8 56.6 Q40.6 55.6 38.6 55.4 Z' },
  { id: 'biceps', d: 'M28 53 Q23.5 54 22.4 60 Q22.6 66 23.9 72.2 Q25.6 72.2 26.5 71 Q28.5 64 28.5 57 Z' },
  { id: 'brachialis', d: 'M22 60.5 Q20.6 66 21 71.5 Q22.3 72.1 23.3 72.1 Q22 66.5 22 60.5 Z' },
  { id: 'forearm', d: 'M21 74 Q16.5 80 15 92 L14.5 105 L19.5 105.5 Q21.5 94 24.5 83 Q26 77 25 74 Z' },
  { id: 'obliques', d: 'M42.4 62.2 Q37.5 63.5 35.4 66.2 Q34.2 76 35.5 85 Q37 95 42.5 101 Q41.5 92 41.5 84 Q41.5 72 42.4 62.2 Z' },
  { id: 'rectus_upper', d: 'M49.5 56.5 L43.5 57 Q42.6 66 42.3 75 L49.5 75 Z' },
  { id: 'rectus_lower', d: 'M49.5 75.7 L42.3 75.7 Q42.4 88 45 101 L49.5 104 Z' },
  { id: 'glute_med', d: 'M35.5 98 Q33 103 32.8 111 Q34.5 112 37 111.5 Q37.5 104.5 39.5 101 Z' },
  { id: 'vastus_lateralis', d: 'M37.5 112.5 Q33.5 126 34.3 142 Q35 152 38 158.5 Q39 157 39.6 152 Q38.6 140 39.3 126 Q39.8 118 40.4 112 Q39 111.8 37.5 112.5 Z' },
  { id: 'rectus_femoris', d: 'M41 112 Q43.6 111.6 46.5 113 Q46.4 122 45.2 134 Q44 146 42.6 153 Q40.8 147 40.3 138 Q39.9 126 41 112 Z' },
  { id: 'vastus_intermedius', d: 'M39.8 128 Q39.4 140 40 150 Q40.5 152 41.3 152.5 Q40.3 146 40.1 138 Q40 132 39.8 128 Z' },
  { id: 'vastus_medialis', d: 'M47.3 136 Q46.6 146 45 158.5 Q41.5 160 39.9 156.5 Q41.6 155 43 153.6 Q45.4 146 47.3 136 Z' },
  { id: 'adductors', d: 'M49.5 113 L47 114 Q48.8 124 48 139 Q47.6 145 46.8 150 Q48.5 149 49.5 145 Z' },
  { id: 'tibialis', d: 'M37.5 165 Q35.5 176 36.3 188 Q37.5 193 39 196 Q40 186 40.3 176 Q40.5 170 40 165 Z' },
  { id: 'gastroc_medial', d: 'M41.5 165.5 Q44.3 171 44.4 179 Q43.4 182 42 183 Q41.2 176 41 172 Z' },
  { id: 'soleus', d: 'M41.9 183.8 Q43.5 182.6 44.3 180 Q44.2 186 42.4 191 Q41.9 187 41.9 183.8 Z' },
];

const BACK: Shape[] = [
  { id: 'trap_upper', d: 'M49.5 24 L46.5 24 Q46 29 40 31 L34.5 33 Q38 35 42 35 Q46.5 35 49.5 37 Z' },
  { id: 'trap_middle', d: 'M49.5 37.6 Q46.5 35.6 42 35.6 Q38 35.6 34.8 33.8 Q35.2 37 37.5 38.5 Q41 41 44 44 Q47 45 49.5 46 Z' },
  { id: 'trap_lower', d: 'M49.5 46.6 Q46.5 45.6 44.3 44.8 Q45.5 48 46 51 Q48 58 49.5 63 Z' },
  { id: 'infraspinatus', d: 'M37.6 39 Q36 42 36.4 46 Q38.5 49 41.8 49.4 Q42.6 46.5 43.6 44.3 Q41 41.5 37.6 39 Z' },
  { id: 'rhomboids', d: 'M44 45 Q42.6 47 42.4 49.6 Q43.9 50.3 45.6 50.7 Q45.2 47.6 44 45 Z' },
  { id: 'delt_rear', d: 'M35 33.5 Q29.5 33 27.5 37.5 Q27 44 28.5 50 Q31.5 46.5 33.5 42 Q34.5 38 36.5 36 Z' },
  { id: 'delt_side', d: 'M28 33.5 Q22.5 35 21.5 42 Q21 49 22.5 54 Q25.5 52.5 28 50 Q26.5 43 27.5 37 Z' },
  { id: 'triceps_lateral', d: 'M26 52.8 Q23 53.5 21.3 60 Q20.6 64 21 67 Q23 64.5 24.2 60 Q25 56 26 52.8 Z' },
  { id: 'triceps_long', d: 'M28 52.5 Q26.8 52.4 26.4 53 Q25.2 57 24.8 61 Q24 65 22.6 67.8 Q24.6 68.6 26.6 69.4 Q28.6 63 28.5 56 Z' },
  { id: 'triceps_medial', d: 'M21 68 Q20.6 69.8 21 71.5 Q24 72.5 26.5 71 L26.4 70.1 Q24.4 69.3 21 68 Z' },
  { id: 'forearm', d: 'M21 74 Q16.5 80 15 92 L14.5 105 L19.5 105.5 Q21.5 94 24.5 83 Q26 77 25 74 Z' },
  { id: 'obliques', d: 'M35 72 Q34.3 82 36 91 Q38.5 97 42.5 99.5 L42.5 92 Q37 85 35 72 Z' },
  { id: 'lats', d: 'M36.6 47 Q33.5 52 34.3 63 Q35.5 78 42 91 L45.5 89 Q44.3 76 45.6 62 Q46 55 45.4 51.4 Q43.6 51 42.2 50.2 Q38.6 49.8 36.6 47 Z' },
  { id: 'erectors', d: 'M49.5 64 L46.6 62 Q45.2 75 45.6 88 Q46 98 46.8 104 L49.5 106 Z' },
  { id: 'glute_med', d: 'M38 99.5 Q34 101 33.5 107 Q34.5 111 38 111 Q43 108 46.5 104 Q42.5 100.5 38 99.5 Z' },
  { id: 'glute_max', d: 'M49.5 106.5 Q45 105.5 40.5 109.5 Q35.5 112 35 119.5 Q35.8 127.5 42 130 Q47 130.5 49.5 127 Z' },
  { id: 'glute_min', d: 'M33.6 108.2 Q33.4 110.6 34.4 112.8 Q35.4 113.3 36.6 112.8 Q34.8 111.6 33.6 108.2 Z' },
  { id: 'biceps_femoris_long', d: 'M42.8 131.3 Q40.2 131.6 38.2 132.5 Q35.2 145 36 158 Q38 159.4 40 159.6 Q40.6 152 41.4 146 Q42.4 138 42.8 131.3 Z' },
  { id: 'biceps_femoris_short', d: 'M36.2 148 Q35.7 153 36 158 Q37.4 159 38.8 159.4 Q38 154 36.2 148 Z' },
  { id: 'semitendinosus', d: 'M43.4 131.2 Q46 131.3 48.6 132 Q48.4 140 47.4 146 Q45.4 150 42 153 Q41.6 148 42.2 143 Q42.8 137 43.4 131.2 Z' },
  { id: 'semimembranosus', d: 'M47.3 146.6 Q46.6 153 45.5 158 Q43.4 159.4 40.6 159.6 Q41.2 156 42.2 153.6 Q45 151 47.3 146.6 Z' },
  { id: 'gastroc_lateral', d: 'M40.4 164.4 Q38 164.3 36.3 165 Q33.8 173 35.4 181 Q37.8 183.5 40 182 Q40.2 173 40.4 164.4 Z' },
  { id: 'gastroc_medial', d: 'M41 164.4 Q43 164.4 44.6 165 Q45.6 174 44.2 182 Q42.2 184.5 40.6 182.6 Q40.8 173 41 164.4 Z' },
  { id: 'soleus', d: 'M35.6 182 Q36 186 36.8 188 Q39.6 190.4 42.5 188 Q43.6 185.8 44.1 183 Q42 185.5 40.3 183.6 Q37.8 184.5 35.6 182 Z' },
];

/** Linhas de desenho (sem cor própria): separações dentro dos músculos, só para dar forma. */
const FRONT_LINES = ['M43.5 66 L49.5 66', 'M43 84.5 L49.5 84.5', 'M43.5 93 L49.5 93'];
const BACK_LINES = ['M49.5 63 L49.5 106'];

const MEASURE_TEXT: Record<Measure, string> = {
  RM: 'Medido por ressonância ou ecografia: o músculo cresceu.',
  EMG: 'Medido por EMG: o músculo estava ativo (não mede crescimento).',
  ANAT: 'Só pela função anatómica do músculo (sem medição).',
};
const CONF_TEXT: Record<Confidence, string> = {
  A: 'A · testado neste exercício',
  B: 'B · herdado do exercício testado mais parecido',
  C: 'C · só pela anatomia',
};

export interface MuscleCard {
  label: string;
  role: 'primary' | 'secondary' | null;
  roleText: string;
  info: PortionInfo | null;
  sources: Source[];
}

/** Cartão do músculo tocado: papel, confiança, fonte e o que a fonte mediu. */
@Component({
  selector: 'app-muscle-card',
  template: `
    @if (card(); as c) {
      <div class="card" role="status">
        <div class="head">
          <strong>{{ c.label }}</strong>
          <span class="role" [class.p]="c.role === 'primary'" [class.s]="c.role === 'secondary'">{{ c.roleText }}</span>
          <button type="button" class="x" aria-label="Fechar" (click)="closed.emit()">×</button>
        </div>
        @if (c.info; as inf) {
          <p class="conf">Confiança {{ confText[inf.confidence] }}</p>
          @for (src of c.sources; track src.key) {
            <p class="src"><a [href]="src.url" target="_blank" rel="noopener">{{ src.label }}</a>
              <span class="measure">{{ measureText[src.measure] }}</span>
              @if (src.note) { <span class="note">({{ src.note }})</span> }
            </p>
          }
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; --mm-p: var(--ion-color-primary); }
    .card { margin: 8px auto 0; max-width: 360px; padding: 8px 10px; border-radius: 8px; background: rgba(128,128,128,0.1); font-size: 0.85rem; text-align: left; }
    .card .head { display: flex; align-items: center; gap: 8px; }
    .card .head strong { flex: 1; }
    .card .role { font-size: 0.75rem; padding: 1px 6px; border-radius: 10px; background: rgba(128,128,128,0.2); }
    .card .role.p { background: var(--mm-p); color: var(--ion-color-primary-contrast, #fff); }
    .card .role.s { border: 1px dashed var(--mm-p); background: none; }
    .card .x { background: none; border: 0; font-size: 1.2rem; line-height: 1; color: var(--ion-color-medium); padding: 0 2px; cursor: pointer; }
    .card p { margin: 4px 0 0; }
    .card .conf { color: var(--ion-color-medium); }
    .card .measure { display: block; color: var(--ion-color-medium); font-size: 0.8rem; }
    .card .note { color: var(--ion-color-medium); font-size: 0.75rem; }
  `,
})
export class MuscleCardComponent {
  readonly card = input<MuscleCard | null>(null);
  readonly closed = output<void>();
  readonly measureText = MEASURE_TEXT;
  readonly confText = CONF_TEXT;
}

/**
 * Figura frente/costas com as porções musculares principais (cheio) e secundárias (claro, tracejado).
 * Músculos profundos (ex.: sóleo, braquial) só mostram a parte que chega à superfície.
 * Ao tocar num músculo abre um cartão com o papel, a medida, a confiança e a fonte (quando há `info`).
 */
@Component({
  selector: 'app-muscle-map',
  imports: [MuscleCardComponent],
  template: `
    <div class="wrap" [class.compact]="compact()">
      @for (v of views; track v.name) {
        <figure>
          <svg viewBox="0 0 100 205" role="img" [attr.aria-label]="v.name + ': ' + summary()">
            @for (side of sides; track side; let i = $index) {
              <g [attr.transform]="side">
                @for (d of body; track d) { <path class="body" [attr.d]="d" /> }
                @for (m of v.shapes; track m.id) {
                  <path class="m" [class.deep]="deep(m.id)" [class.p]="isPrimary(m.id, sideOf(v.name, i))" [class.s]="isSecondary(m.id, sideOf(v.name, i))"
                    [class.sel]="selected() === m.id" [attr.d]="m.d" (click)="pick(m.id)" />
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
    @if (card() && !cardOutside()) {
      <app-muscle-card [card]="card()" (closed)="selected.set(null)" />
    } @else if (!compact()) {
      <p class="text">{{ summary() }}</p>
    }
    @if (info() && !card() && !cardOutside()) { <p class="hint">Toca num músculo para ver a fonte.</p> }
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
    .m { fill: rgba(128,128,128,0.1); stroke: rgba(128,128,128,0.35); stroke-width: 0.4; cursor: pointer; }
    .m.deep { stroke-dasharray: 0.8 0.6; }
    .m.s { fill: var(--mm-p); fill-opacity: 0.38; stroke: var(--mm-p); stroke-width: 0.7; stroke-dasharray: 1.6 1; }
    .line { fill: none; stroke: rgba(128,128,128,0.4); stroke-width: 0.35; stroke-linecap: round; pointer-events: none; }
    .m.p { fill: var(--mm-p); fill-opacity: 1; stroke: var(--ion-background-color, #fff); stroke-width: 0.6; stroke-dasharray: none; }
    .m.sel { stroke: var(--ion-text-color, #000); stroke-width: 0.9; stroke-dasharray: none; }
    .legend { display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 0.8rem; margin: 6px 0 2px; color: var(--ion-color-medium); }
    .key { width: 14px; height: 10px; border-radius: 2px; display: inline-block; background: var(--mm-p); margin-left: 8px; }
    .key.s { opacity: 0.38; border: 1px dashed var(--mm-p); box-sizing: border-box; }
    .text { text-align: center; font-size: 0.85rem; margin: 2px 0 0; }
    .hint { text-align: center; font-size: 0.75rem; color: var(--ion-color-medium); margin: 2px 0 0; }
  `,
})
export class MuscleMapComponent {
  /** Porções musculares (ids de core/anatomy/portions.ts). */
  readonly primary = input<readonly string[]>([]);
  readonly secondary = input<readonly string[]>([]);
  /** Papel, confiança e fontes por porção (de portionsFor); sem isto o cartão só mostra o nome e o papel. */
  readonly info = input<Partial<Record<PortionId, PortionInfo>> | null>(null);
  /**
   * Músculos por lado do corpo (esquerdo/direito), para exercícios unilaterais. Sem isto, os dois lados são iguais.
   * Na frente, o lado direito da pessoa fica à esquerda da imagem; nas costas, ao contrário.
   */
  readonly bySide = input<{ left: SideMuscles; right: SideMuscles } | null>(null);
  readonly primaryLabel = input('Principal');
  readonly secondaryLabel = input('Secundário');
  /** Figuras mais pequenas e sem o texto por baixo (para ecrãs que já têm muito conteúdo). */
  readonly compact = input(false);
  /** O cartão do músculo tocado é desenhado pelo ecrã (usar `card()` com <app-muscle-card>), não por baixo da figura. */
  readonly cardOutside = input(false);

  readonly body = BODY;
  readonly sides = ['', 'translate(100 0) scale(-1 1)'];
  readonly views = [
    { name: 'Frente', shapes: FRONT, lines: FRONT_LINES },
    { name: 'Costas', shapes: BACK, lines: BACK_LINES },
  ];
  readonly measureText = MEASURE_TEXT;
  readonly confText = CONF_TEXT;
  readonly selected = signal<string | null>(null);

  /** Lado da pessoa que cada metade da figura mostra (i = 0 é a metade desenhada à esquerda da imagem). */
  sideOf = (view: string, i: number): 'left' | 'right' => ((view === 'Frente') === (i === 0) ? 'right' : 'left');
  deep = (id: string) => !!PORTION[id as PortionId]?.deep;

  private muscles(side?: 'left' | 'right'): SideMuscles {
    const b = this.bySide();
    return b && side ? b[side] : { primary: this.primary(), secondary: this.secondary() };
  }
  isPrimary = (id: string, side?: 'left' | 'right') => this.muscles(side).primary.includes(id);
  isSecondary = (id: string, side?: 'left' | 'right') => !this.isPrimary(id, side) && this.muscles(side).secondary.includes(id);

  pick(id: string): void {
    this.selected.update((cur) => (cur === id ? null : id));
  }

  readonly card = computed<MuscleCard | null>(() => {
    const id = this.selected();
    if (!id) return null;
    const role = this.isPrimary(id) ? 'primary' : this.isSecondary(id) ? 'secondary' : null;
    const info = role ? this.info()?.[id as PortionId] ?? null : null;
    return {
      label: PORTION[id as PortionId]?.label ?? id,
      role,
      roleText: role === 'primary' ? this.primaryLabel() : role === 'secondary' ? this.secondaryLabel() : 'Não trabalhado aqui',
      info,
      sources: (info?.sources ?? []).map((k) => SOURCES[k]).filter((x) => !!x),
    };
  });

  readonly summary = computed(() => {
    const names = (l: readonly string[]) => l.map((m) => PORTION[m as PortionId]?.label ?? m).join(', ');
    const p = names(this.primary());
    const s = names(this.secondary().filter((m) => !this.primary().includes(m)));
    if (!p && !s) return 'Sem músculos indicados.';
    return [p && `Principais: ${p}.`, s && `Secundários: ${s}.`].filter(Boolean).join(' ');
  });
}
