import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import type { Motion, Pt } from '../core/motion/motion-core';
import { StanceGuideComponent, stanceApplies } from './stance-guide.component';

const rm = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Implemento desenhado nas mãos: depende do equipamento do exercício. */
export type Implement = 'bar' | 'db' | 'kb' | 'cable' | 'band' | 'machine' | 'none' | 'legacy';

export function implementOf(equipment: string | null | undefined): Implement {
  switch (equipment) {
    case undefined: return 'legacy';
    case 'barbell': return 'bar';
    case 'dumbbell': return 'db';
    case 'kettlebell': return 'kb';
    case 'cable': return 'cable';
    case 'band': return 'band';
    case 'machine': return 'machine';
    default: return 'none';
  }
}

const LEGEND: Record<Implement, string | null> = {
  bar: 'Barra', db: 'Halteres', kb: 'Kettlebell', cable: 'Cabo', band: 'Elástico', machine: 'Máquina', none: null, legacy: null,
};

let uid = 0;

interface Track { x: number[]; y: number[]; t: string }

/**
 * Animação esquemática do movimento (boneco de lado ou de frente): vai e volta entre duas poses.
 * Mostra o implemento certo (barra, halteres, cabo, máquina…) e a trajetória (seta a tracejado).
 * Respeita «reduzir movimento».
 */
@Component({
  selector: 'app-exercise-motion',
  imports: [StanceGuideComponent],
  template: `
    @if (view(); as v) {
      <figure>
        <svg #svg viewBox="0 0 100 100" role="img" [attr.aria-label]="'Animação esquemática: ' + motion().label">
          <defs>
            <marker [attr.id]="mid" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse">
              <path d="M0 0 L6 3 L0 6 z" class="arrowhead" />
            </marker>
          </defs>
          <path class="floor" d="M8 90 H92" />
          @for (p of props(); track p.d) { <path [class]="'prop ' + p.kind" [attr.d]="p.d" /> }
          @for (a of v.arrows; track $index) { <path class="traj" [attr.d]="a" [attr.marker-start]="'url(#' + mid + ')'" [attr.marker-end]="'url(#' + mid + ')'" /> }
          @if (v.cable; as c) {
            <line [class]="'cable ' + impl()" [attr.x1]="c.from[0]" [attr.y1]="c.from[1]" [attr.x2]="c.x[0]" [attr.y2]="c.y[0]">
              @if (animate()) {
                <animate attributeName="x2" [attr.values]="c.x.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
                <animate attributeName="y2" [attr.values]="c.y.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
              }
            </line>
            <circle class="pulley" r="2.2" [attr.cx]="c.from[0]" [attr.cy]="c.from[1]" />
          }
          @if (v.bar; as b) {
            <line class="barline" [attr.x1]="b.a.x[0]" [attr.y1]="b.a.y[0]" [attr.x2]="b.b.x[0]" [attr.y2]="b.b.y[0]">
              @if (animate()) {
                <animate attributeName="x1" [attr.values]="b.a.x.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
                <animate attributeName="y1" [attr.values]="b.a.y.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
                <animate attributeName="x2" [attr.values]="b.b.x.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
                <animate attributeName="y2" [attr.values]="b.b.y.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
              }
            </line>
          }
          <g class="body">
            @for (l of v.lines; track $index) {
              <polyline [attr.points]="l.v[0]">
                @if (animate()) { <animate attributeName="points" [attr.values]="l.v.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" /> }
              </polyline>
            }
          </g>
          <circle class="head" r="5.5" [attr.cx]="v.head.x[0]" [attr.cy]="v.head.y[0]">
            @if (animate()) {
              <animate attributeName="cx" [attr.values]="v.head.x.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
              <animate attributeName="cy" [attr.values]="v.head.y.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
            }
          </circle>
          @for (w of v.loads; track $index) {
            <g class="impl" [attr.transform]="'translate(' + w.x[0] + ' ' + w.y[0] + ')'">
              @if (animate()) {
                <animateTransform attributeName="transform" type="translate" [attr.values]="w.t" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
              }
              @switch (impl()) {
                @case ('bar') { <circle class="plate bar" r="6.2" /><circle class="barend" r="1.3" /> }
                @case ('db') { <rect class="plate db" x="-3.7" y="-3.7" width="7.4" height="7.4" rx="1.6" /> }
                @case ('kb') { <path class="kbh" d="M-2.6 0 V-3 Q0 -6 2.6 -3 V0" /><circle class="plate kb" cy="2" r="4.2" /> }
                @case ('machine') { <circle class="plate handle" r="2.6" /> }
                @case ('cable') { <circle class="plate handle cab" r="2.4" /> }
                @case ('band') { <circle class="plate handle bnd" r="2.4" /> }
                @case ('legacy') { <circle class="plate legacy" r="3.4" /> }
              }
            </g>
          }
        </svg>
        <figcaption>
          {{ motion().label }}
          @if (legend(); as l) { · <span [class]="'chip ' + impl()">{{ l }}</span> }
          @if (animate()) { <button type="button" (click)="toggle($event)">{{ paused() ? 'Reproduzir' : 'Pausar' }}</button> }
        </figcaption>
      </figure>
      @if (stance()) { <app-stance-guide [motionId]="motion().id" /> }
    }
  `,
  styles: `
    :host { display: block; --em-c: #0f766e; --em-bg: rgba(128,128,128,0.12); --c-bar: #f97316; --c-db: #3b82f6; --c-kb: #d946ef; --c-cable: #0ea5e9; --c-band: #65a30d; --c-machine: #8b5cf6; --c-bench: #06b6d4; --c-traj: #eab308; }
    figure { margin: 0; text-align: center; }
    svg { width: 100%; max-width: 200px; height: auto; background: var(--em-bg); border-radius: 12px; display: block; margin: 0 auto; }
    .floor { stroke: rgba(128,128,128,0.5); stroke-width: 1; fill: none; }
    .prop { stroke: rgba(128,128,128,0.8); stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .prop.bench, .prop.pad, .prop.incline { stroke: var(--c-bench); stroke-width: 3; }
    :host(.machine) .prop.machine { stroke: var(--c-machine); stroke-width: 3; }
    .prop.bar { stroke: #555; stroke-width: 2.4; }
    .prop.cable { stroke: var(--c-cable); stroke-width: 1.4; stroke-dasharray: 2 2; }
    .cable { stroke: var(--c-cable); stroke-width: 1.3; }
    .cable.band { stroke: var(--c-band); stroke-width: 1.8; stroke-dasharray: 3 1.6; }
    .pulley { fill: #fff; stroke: var(--c-cable); stroke-width: 1.2; }
    .barline { stroke: #444; stroke-width: 2.2; stroke-linecap: round; }
    .body polyline { stroke: var(--em-c); stroke-width: 4.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .head { fill: var(--em-c); }
    .barend { fill: var(--c-bar); }
    .kbh { fill: none; stroke: #86198f; stroke-width: 1.4; }
    .plate.bar { fill: rgba(249,115,22,0.35); stroke: var(--c-bar); stroke-width: 1.6; }
    .plate.db { fill: var(--c-db); stroke: #1e40af; stroke-width: 0.8; }
    .plate.kb { fill: var(--c-kb); stroke: #86198f; stroke-width: 0.8; }
    .plate.handle { fill: #fff; stroke: var(--c-machine); stroke-width: 1.6; }
    .plate.handle.cab { stroke: var(--c-cable); }
    .plate.handle.bnd { stroke: var(--c-band); }
    .plate.legacy { fill: var(--ion-text-color, #222); }
    .traj { fill: none; stroke: var(--c-traj); stroke-width: 1.6; stroke-dasharray: 3 2.2; stroke-linecap: round; opacity: 0.9; }
    .arrowhead { fill: var(--c-traj); }
    figcaption { font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 4px; }
    figcaption button { margin-left: 6px; font: inherit; background: none; border: 0; color: var(--ion-color-primary); cursor: pointer; text-decoration: underline; }
    .chip { display: inline-block; padding: 0 6px; border-radius: 8px; color: #fff; font-weight: 600; }
    .chip.bar { background: var(--c-bar); } .chip.db { background: var(--c-db); } .chip.kb { background: var(--c-kb); }
    .chip.cable { background: var(--c-cable); } .chip.band { background: var(--c-band); } .chip.machine { background: var(--c-machine); }
    @media (prefers-color-scheme: dark) { :host { --em-c: #2cb5a8; } .prop.bar, .barline { stroke: #ccc; } }
  `,
  host: { '[class.machine]': "impl() === 'machine'" },
})
export class ExerciseMotionComponent {
  readonly motion = input.required<Motion>();
  /** Chave do equipamento (barbell, dumbbell, cable, machine…). Sem ela, desenha o peso genérico. */
  readonly equipment = input<string | null | undefined>(undefined);
  readonly dur = '2.6s';
  readonly mid = `em-arrow-${++uid}`;
  readonly paused = signal(false);
  readonly animate = signal(!rm());
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  /** Sequência de keyframes: de → meio → para → meio → de. */
  readonly keyTimes = '0;0.25;0.5;0.75;1';
  readonly splines = '.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1';

  readonly impl = computed(() => implementOf(this.equipment()));
  readonly legend = computed(() => LEGEND[this.impl()]);
  readonly stance = computed(() => stanceApplies(this.motion().id));
  /** Só os props que ainda fazem sentido: com cabo ou elástico, o fio é desenhado até à mão. */
  readonly props = computed(() => {
    const dyn = this.impl() === 'cable' || this.impl() === 'band';
    return this.motion().props.filter((p) => !(dyn && p.kind === 'cable'));
  });

  readonly view = computed(() => {
    const m = this.motion();
    const impl = this.impl();
    const seq = [m.from, m.mid, m.to, m.mid, m.from];
    const track = (i: number, pick: (f: typeof m.from) => Pt[]): Track => {
      const x = seq.map((f) => pick(f)[i][0]);
      const y = seq.map((f) => pick(f)[i][1]);
      return { x, y, t: x.map((v, k) => `${v} ${y[k]}`).join(';') };
    };
    const hands = m.from.hands.map((_, i) => track(i, (f) => f.hands));
    const feet = m.from.feet.map((_, i) => track(i, (f) => f.feet));
    const info = analyse(m);
    // implemento nas mãos: só nos exercícios com carga nas mãos
    const loads = impl === 'none' || !m.from.weights.length ? [] : impl === 'legacy' ? m.from.weights.map((_, i) => track(i, (f) => f.weights)) : hands;
    // fio do cabo/elástico: da polia à mão (ou ao pé, nos exercícios de perna)
    let cable: { from: Pt; x: number[]; y: number[] } | null = null;
    if (impl === 'cable' || impl === 'band') {
      const end = info.group === 'feet' ? feet[0] : hands[0];
      const pc = m.props.find((p) => p.kind === 'cable');
      // o desenho do cabo vai do boneco à polia: a polia é a ponta mais longe da mão
      const far = pc ? farthest(pathPoints(pc.d), [end.x[0], end.y[0]]) : null;
      const from: Pt = m.pulley ?? far ?? [90, impl === 'band' ? 86 : Math.round(end.y[0])];
      cable = { from, x: end.x, y: end.y };
    }
    // barra com duas mãos (vista de frente): a barra liga as mãos
    const bar = impl === 'bar' && loads.length === 2 ? { a: hands[0], b: hands[1] } : null;
    return {
      lines: m.from.lines.map((_, i) => ({ v: seq.map((f) => f.lines[i]) })),
      head: { x: seq.map((f) => f.head[0]), y: seq.map((f) => f.head[1]) },
      loads, cable, bar, arrows: info.arrows,
    };
  });

  toggle(ev: Event): void {
    ev.stopPropagation();
    const el = this.svg()?.nativeElement;
    if (!el) return;
    if (this.paused()) el.unpauseAnimations();
    else el.pauseAnimations();
    this.paused.update((p) => !p);
  }
}

/** Pontos absolutos de um caminho simples (M, L, H, V; maiúsculas). */
export function pathPoints(d: string): Pt[] {
  const out: Pt[] = [];
  let x = 0, y = 0;
  for (const m of d.matchAll(/([MLHV])\s*(-?[\d.]+)(?:[ ,]+(-?[\d.]+))?/g)) {
    const a = Number(m[2]);
    if (m[1] === 'H') x = a;
    else if (m[1] === 'V') y = a;
    else { x = a; y = Number(m[3]); }
    out.push([x, y]);
  }
  return out;
}
function farthest(pts: Pt[], from: Pt): Pt | null {
  return pts.reduce<Pt | null>((best, p) => (!best || dist(p, from) > dist(best, from) ? p : best), null);
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** O ponto que mais se desloca (mãos, pés ou cabeça) e as setas da sua trajetória: arcos que passam pela pose do meio. */
export function analyse(m: Motion): { group: 'hands' | 'feet' | 'head' | null; arrows: string[] } {
  const groups: Array<{ name: 'hands' | 'feet' | 'head'; pts: (f: Motion['from']) => Pt[] }> = [
    { name: 'hands', pts: (f) => f.hands }, { name: 'feet', pts: (f) => f.feet }, { name: 'head', pts: (f) => [f.head] },
  ];
  let best: { score: number; idx: number[]; g: (typeof groups)[number] } | null = null;
  for (const g of groups) {
    const a = g.pts(m.from), b = g.pts(m.to), c = g.pts(m.mid);
    const d = a.map((p, i) => Math.max(dist(p, b[i]), dist(p, c[i]) * 2));
    const max = Math.max(...d);
    if (!best || max > best.score * 1.15) best = { score: max, idx: d.map((v, i) => (v >= max * 0.5 ? i : -1)).filter((i) => i >= 0), g };
  }
  if (!best || best.score < 7) return { group: best?.g.name ?? null, arrows: [] };
  const a = best.g.pts(m.from), b = best.g.pts(m.to), c = best.g.pts(m.mid);
  const r = (n: number) => Math.round(n * 10) / 10;
  const arrows = best.idx.map((i) => {
    // curva de Bézier quadrática que passa por «meio» (t = 0.5)
    const cx = 2 * c[i][0] - (a[i][0] + b[i][0]) / 2;
    const cy = 2 * c[i][1] - (a[i][1] + b[i][1]) / 2;
    return `M${r(a[i][0])} ${r(a[i][1])} Q${r(cx)} ${r(cy)} ${r(b[i][0])} ${r(b[i][1])}`;
  });
  return { group: best.g.name, arrows };
}
