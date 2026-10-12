import { Component, computed, input } from '@angular/core';

/** Exercícios cuja animação mostra também a posição dos pés (agachamentos e prensa/hack). */
export const STANCE_MOTIONS: ReadonlySet<string> = new Set(['squat', 'squat-front', 'goblet', 'squat-bw', 'squat-box', 'squat-sumo', 'hack', 'legpress', 'wallsit']);

export const stanceApplies = (motionId: string): boolean => STANCE_MOTIONS.has(motionId);

interface Option { label: string; sub: string; angle: number; gap: number; rec: boolean }
interface Variant { angles: Option[]; widths: Option[]; tip: string }

const PARALLEL: Option = { label: 'Paralelos', sub: '0°', angle: 0, gap: 20, rec: false };
const INWARD: Option = { label: 'Para dentro', sub: 'evitar', angle: -16, gap: 14, rec: false };
const NARROW: Option = { label: 'Estreita', sub: 'pés juntos', angle: 8, gap: 9, rec: false };
const SHOULDER: Option = { label: 'Ombros', sub: 'base normal', angle: 22, gap: 20, rec: true };
const WIDE: Option = { label: 'Larga', sub: 'sumo / anca', angle: 28, gap: 34, rec: false };

/** Pés: por defeito agachamento (15–30°, ombros; Starting Strength: ~30–35° no agachamento com barra). */
const BASE: Variant = {
  angles: [PARALLEL, { label: 'Abertos', sub: '15–30°', angle: 22, gap: 20, rec: true }, INWARD],
  widths: [NARROW, SHOULDER, WIDE],
  tip: 'Ponto de partida: pés à largura dos ombros e pontas abertas 15–30°. Ajusta à tua anca: o joelho segue a direção da ponta do pé e os calcanhares ficam no chão.',
};
const VARIANTS: Record<string, Variant> = {
  // Sumo: base ~1,5–2× a largura dos ombros e pontas a 30–45°; joelhos acompanham as pontas.
  'squat-sumo': {
    angles: [PARALLEL, { label: 'Muito abertos', sub: '30–45°', angle: 38, gap: 34, rec: true }, INWARD],
    widths: [NARROW, { ...SHOULDER, rec: false }, { ...WIDE, label: 'Larga', sub: '1,5–2× ombros', rec: true, angle: 38 }],
    tip: 'Sumo: pés bem afastados (cerca de 1,5–2× a largura dos ombros) e pontas a 30–45°. Os joelhos abrem na direção das pontas e o tronco fica direito.',
  },
  // Prensa: pés a meio da plataforma, largura dos ombros, pontas 10–15°; joelhos sobre o 2.º dedo.
  legpress: {
    angles: [PARALLEL, { label: 'Ligeiramente abertos', sub: '10–15°', angle: 12, gap: 20, rec: true }, INWARD],
    widths: [NARROW, SHOULDER, { ...WIDE, sub: '30–45° se larga', angle: 36 }],
    tip: 'Prensa: pés a meio da plataforma, largura dos ombros, pontas 10–15°. Joelhos sobre o 2.º dedo, desce até ~90–100° sem a anca sair do banco e pára a ~5° do bloqueio.',
  },
  // Wall sit: pés paralelos, à largura da anca/ombros, joelhos exatamente sobre os tornozelos.
  wallsit: {
    angles: [{ ...PARALLEL, rec: true }, { label: 'Abertos', sub: '15°', angle: 15, gap: 20, rec: false }, INWARD],
    widths: [NARROW, SHOULDER, WIDE],
    tip: 'Wall sit: costas encostadas à parede, coxas paralelas ao chão (joelhos a 90°) e joelhos sobre os tornozelos. Pés à largura da anca/ombros.',
  },
};

const FOOT = 'M0 -9 C3.2 -9 4.2 -4 3.4 2 C3 6 1.8 9 0 9 C-2.2 9 -3.4 6.6 -3.4 3 C-3.4 -3 -2.8 -9 0 -9 Z';

/**
 * Vista de cima da posição dos pés no agachamento: ângulo das pontas (paralelos, abertos, para dentro)
 * e largura da base (estreita, ombros, larga). A opção de partida recomendada vem destacada.
 */
@Component({
  selector: 'app-stance-guide',
  template: `
    <section aria-label="Posição dos pés">
      <h4>Posição dos pés (vista de cima)</h4>
      <p class="cap">Ângulo das pontas</p>
      <div class="row">
        @for (o of variant().angles; track o.label) {
          <figure [class.rec]="o.rec">
            <svg viewBox="0 0 60 34" aria-hidden="true">
              <g [attr.transform]="'translate(' + (30 - o.gap / 2) + ' 17) rotate(' + (-o.angle) + ')'"><path [attr.d]="foot" /></g>
              <g [attr.transform]="'translate(' + (30 + o.gap / 2) + ' 17) rotate(' + o.angle + ')'"><path [attr.d]="foot" /></g>
            </svg>
            <figcaption><b>{{ o.label }}</b><span>{{ o.sub }}</span></figcaption>
          </figure>
        }
      </div>
      <p class="cap">Largura da base</p>
      <div class="row">
        @for (o of variant().widths; track o.label) {
          <figure [class.rec]="o.rec">
            <svg viewBox="0 0 60 34" aria-hidden="true">
              <g [attr.transform]="'translate(' + (30 - o.gap / 2) + ' 17) rotate(' + (-o.angle) + ')'"><path [attr.d]="foot" /></g>
              <g [attr.transform]="'translate(' + (30 + o.gap / 2) + ' 17) rotate(' + o.angle + ')'"><path [attr.d]="foot" /></g>
            </svg>
            <figcaption><b>{{ o.label }}</b><span>{{ o.sub }}</span></figcaption>
          </figure>
        }
      </div>
      <p class="tip">{{ variant().tip }}</p>
    </section>
  `,
  styles: `
    :host { display: block; margin-top: 10px; --g-c: var(--ion-color-medium, #888); --g-rec: var(--ion-color-primary); }
    section { max-width: 280px; margin: 0 auto; text-align: center; }
    h4 { margin: 0 0 4px; font-size: 0.82rem; font-weight: 600; }
    .cap { margin: 8px 0 2px; font-size: 0.7rem; color: var(--ion-color-medium); text-align: left; }
    .row { display: flex; gap: 6px; }
    figure { flex: 1; margin: 0; padding: 4px 2px; border-radius: 10px; border: 1.5px solid transparent; background: rgba(128,128,128,0.1); }
    figure.rec { border-color: var(--g-rec); background: rgba(var(--ion-color-primary-rgb), 0.14); }
    svg { width: 100%; height: auto; display: block; }
    path { fill: var(--g-c); }
    figure.rec path { fill: var(--g-rec); }
    figcaption { font-size: 0.66rem; line-height: 1.2; display: flex; flex-direction: column; }
    figcaption b { font-weight: 600; }
    figcaption span { color: var(--ion-color-medium); }
    .tip { margin: 8px 0 0; font-size: 0.7rem; color: var(--ion-color-medium); text-align: left; }
  `,
})
export class StanceGuideComponent {
  readonly motionId = input<string>('');
  readonly foot = FOOT;
  readonly variant = computed<Variant>(() => VARIANTS[this.motionId()] ?? BASE);
  readonly show = computed(() => stanceApplies(this.motionId()));
}
