import { Component, computed, input } from '@angular/core';

/** Exercícios cuja animação mostra também a posição dos pés (agachamentos e prensa/hack). */
export const STANCE_MOTIONS: ReadonlySet<string> = new Set(['squat', 'squat-front', 'goblet', 'squat-bw', 'squat-box', 'hack', 'legpress']);

export const stanceApplies = (motionId: string): boolean => STANCE_MOTIONS.has(motionId);

interface Option { label: string; sub: string; angle: number; gap: number; rec: boolean }

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
        @for (o of angles; track o.label) {
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
        @for (o of widths; track o.label) {
          <figure [class.rec]="o.rec">
            <svg viewBox="0 0 60 34" aria-hidden="true">
              <g [attr.transform]="'translate(' + (30 - o.gap / 2) + ' 17) rotate(' + (-o.angle) + ')'"><path [attr.d]="foot" /></g>
              <g [attr.transform]="'translate(' + (30 + o.gap / 2) + ' 17) rotate(' + o.angle + ')'"><path [attr.d]="foot" /></g>
            </svg>
            <figcaption><b>{{ o.label }}</b><span>{{ o.sub }}</span></figcaption>
          </figure>
        }
      </div>
      <p class="tip">Ponto de partida: pés à largura dos ombros e pontas abertas 15–30°. Ajusta à tua anca: o joelho segue a direção da ponta do pé e os calcanhares ficam no chão.</p>
    </section>
  `,
  styles: `
    :host { display: block; margin-top: 10px; --g-c: var(--ion-color-medium, #888); --g-rec: #0f766e; }
    section { max-width: 280px; margin: 0 auto; text-align: center; }
    h4 { margin: 0 0 4px; font-size: 0.82rem; font-weight: 600; }
    .cap { margin: 8px 0 2px; font-size: 0.7rem; color: var(--ion-color-medium); text-align: left; }
    .row { display: flex; gap: 6px; }
    figure { flex: 1; margin: 0; padding: 4px 2px; border-radius: 10px; border: 1.5px solid transparent; background: rgba(128,128,128,0.1); }
    figure.rec { border-color: var(--g-rec); background: rgba(15,118,110,0.14); }
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
  readonly angles: Option[] = [
    { label: 'Paralelos', sub: '0°', angle: 0, gap: 20, rec: false },
    { label: 'Abertos', sub: '15–30°', angle: 22, gap: 20, rec: true },
    { label: 'Para dentro', sub: 'evitar', angle: -16, gap: 14, rec: false },
  ];
  readonly widths: Option[] = [
    { label: 'Estreita', sub: 'pés juntos', angle: 8, gap: 9, rec: false },
    { label: 'Ombros', sub: 'base normal', angle: 22, gap: 20, rec: true },
    { label: 'Larga', sub: 'sumo / anca', angle: 28, gap: 34, rec: false },
  ];
  readonly show = computed(() => stanceApplies(this.motionId()));
}
