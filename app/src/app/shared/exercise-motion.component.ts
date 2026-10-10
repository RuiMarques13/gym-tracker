import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import { bodyPoints, joints, Motion } from '../core/motion/motion';

const rm = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animação esquemática do movimento (boneco de lado): vai e volta entre duas poses. Respeita «reduzir movimento». */
@Component({
  selector: 'app-exercise-motion',
  template: `
    @if (frames(); as f) {
      <figure>
        <svg #svg viewBox="0 0 100 100" role="img" [attr.aria-label]="'Animação esquemática: ' + motion().label">
          <path class="floor" d="M8 90 H92" />
          @for (p of motion().props; track p.d) { <path class="prop" [attr.d]="p.d" /> }
          <g class="body">
            <polyline [attr.points]="f.from.leg">
              @if (animate()) { <animate attributeName="points" [attr.values]="vals(f.from.leg, f.to.leg)" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .25 1;.45 0 .25 1" /> }
            </polyline>
            <polyline [attr.points]="f.from.torso">
              @if (animate()) { <animate attributeName="points" [attr.values]="vals(f.from.torso, f.to.torso)" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .25 1;.45 0 .25 1" /> }
            </polyline>
            <polyline [attr.points]="f.from.arm">
              @if (animate()) { <animate attributeName="points" [attr.values]="vals(f.from.arm, f.to.arm)" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .25 1;.45 0 .25 1" /> }
            </polyline>
          </g>
          <circle class="head" r="5.5" [attr.cx]="f.hx0" [attr.cy]="f.hy0">
            @if (animate()) {
              <animate attributeName="cx" [attr.values]="f.hx0 + ';' + f.hx1 + ';' + f.hx0" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .25 1;.45 0 .25 1" />
              <animate attributeName="cy" [attr.values]="f.hy0 + ';' + f.hy1 + ';' + f.hy0" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .25 1;.45 0 .25 1" />
            }
          </circle>
          @if (motion().weight) {
            <circle class="weight" r="3.4" [attr.cx]="f.wx0" [attr.cy]="f.wy0">
              @if (animate()) {
                <animate attributeName="cx" [attr.values]="f.wx0 + ';' + f.wx1 + ';' + f.wx0" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .25 1;.45 0 .25 1" />
                <animate attributeName="cy" [attr.values]="f.wy0 + ';' + f.wy1 + ';' + f.wy0" [attr.dur]="dur" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .25 1;.45 0 .25 1" />
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

  readonly frames = computed(() => {
    const m = this.motion();
    const a = joints(m.from);
    const b = joints(m.to);
    const pa = bodyPoints(a);
    const pb = bodyPoints(b);
    return {
      from: pa, to: pb, hx0: a.head[0], hy0: a.head[1], hx1: b.head[0], hy1: b.head[1],
      wx0: a.wrist[0], wy0: a.wrist[1], wx1: b.wrist[0], wy1: b.wrist[1],
    };
  });

  vals = (a: string, b: string) => `${a};${b};${a}`;

  toggle(ev: Event): void {
    ev.stopPropagation();
    const el = this.svg()?.nativeElement;
    if (!el) return;
    if (this.paused()) el.unpauseAnimations();
    else el.pauseAnimations();
    this.paused.update((p) => !p);
  }
}
