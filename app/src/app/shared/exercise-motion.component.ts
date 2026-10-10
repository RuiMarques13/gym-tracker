import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import type { Motion } from '../core/motion/motion-core';

const rm = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animação esquemática do movimento (boneco de lado): vai e volta entre duas poses. Respeita «reduzir movimento». */
@Component({
  selector: 'app-exercise-motion',
  template: `
    @if (view(); as v) {
      <figure>
        <svg #svg viewBox="0 0 100 100" role="img" [attr.aria-label]="'Animação esquemática: ' + motion().label">
          <path class="floor" d="M8 90 H92" />
          @for (p of motion().props; track p.d) { <path class="prop" [attr.d]="p.d" /> }
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
          @for (w of v.weights; track $index) {
            <circle class="weight" r="3.4" [attr.cx]="w.x[0]" [attr.cy]="w.y[0]">
              @if (animate()) {
                <animate attributeName="cx" [attr.values]="w.x.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
                <animate attributeName="cy" [attr.values]="w.y.join(';')" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" [attr.keyTimes]="keyTimes" [attr.keySplines]="splines" />
              }
            </circle>
          }
        </svg>
        <figcaption>
          {{ motion().label }} · esquema do movimento
          @if (animate()) { <button type="button" (click)="toggle($event)">{{ paused() ? 'Reproduzir' : 'Pausar' }}</button> }
        </figcaption>
      </figure>
    }
  `,
  styles: `
    :host { display: block; --em-c: #0f766e; --em-bg: rgba(128,128,128,0.12); }
    figure { margin: 0; text-align: center; }
    svg { width: 100%; max-width: 200px; height: auto; background: var(--em-bg); border-radius: 12px; display: block; margin: 0 auto; }
    .floor { stroke: rgba(128,128,128,0.5); stroke-width: 1; fill: none; }
    .prop { stroke: rgba(128,128,128,0.8); stroke-width: 2; fill: none; stroke-linecap: round; }
    .body polyline { stroke: var(--em-c); stroke-width: 4.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .head { fill: var(--em-c); }
    .weight { fill: var(--ion-text-color, #222); }
    figcaption { font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 4px; }
    figcaption button { margin-left: 6px; font: inherit; background: none; border: 0; color: var(--ion-color-primary); cursor: pointer; text-decoration: underline; }
    @media (prefers-color-scheme: dark) { :host { --em-c: #2cb5a8; } }
  `,
})
export class ExerciseMotionComponent {
  readonly motion = input.required<Motion>();
  readonly dur = '2.6s';
  readonly paused = signal(false);
  readonly animate = signal(!rm());
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  /** Sequência de keyframes: de → meio → para → meio → de. */
  readonly keyTimes = '0;0.25;0.5;0.75;1';
  readonly splines = '.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1';

  readonly view = computed(() => {
    const m = this.motion();
    const seq = [m.from, m.mid, m.to, m.mid, m.from];
    return {
      lines: m.from.lines.map((_, i) => ({ v: seq.map((f) => f.lines[i]) })),
      head: { x: seq.map((f) => f.head[0]), y: seq.map((f) => f.head[1]) },
      weights: m.from.weights.map((_, i) => ({ x: seq.map((f) => f.weights[i][0]), y: seq.map((f) => f.weights[i][1]) })),
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
