import { Component, computed, input } from '@angular/core';
import type { WeekProgress } from '../core/metrics/volume';

const W = 340;
const H = 132;
const M = { left: 6, right: 34, top: 14, bottom: 20 };
const DAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/**
 * Gráfico pequeno do alvo da semana: a reta tracejada é o ritmo para chegar ao alvo no domingo; a linha cheia é o que
 * já fizeste (séries efetivas por músculo, cada um limitado ao seu alvo). Acima da reta = à frente do ritmo.
 */
@Component({
  selector: 'app-week-progress-chart',
  template: `
    <div class="head">
      <div class="big"><span class="value">{{ n(p().done) }}</span><small> / {{ n(p().target) }} séries</small></div>
      <span class="pill" [class.ahead]="delta() >= 0" [class.behind]="delta() < 0">{{ status() }}</span>
    </div>
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="aria()">
      <defs>
        <linearGradient id="wp-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--wp-real)" stop-opacity="0.28" />
          <stop offset="1" stop-color="var(--wp-real)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line class="base" [attr.x1]="M.left" [attr.x2]="W - M.right" [attr.y1]="y(0)" [attr.y2]="y(0)" />
      <line class="goal" [attr.x1]="M.left" [attr.x2]="W - M.right" [attr.y1]="y(p().target)" [attr.y2]="y(p().target)" />
      <text class="axis" [attr.x]="W - M.right + 4" [attr.y]="y(p().target) + 3.5">alvo</text>
      <path class="area" [attr.d]="area()" />
      <polyline class="pace" [attr.points]="pacePts()" />
      <polyline class="real" [attr.points]="realPts()" />
      @if (end(); as e) {
        <circle class="dot" [attr.cx]="e.x" [attr.cy]="e.y" r="4.5" />
        <text class="now" [attr.x]="e.x" [attr.y]="e.y - 9" text-anchor="middle">{{ n(p().done) }}</text>
      }
      @for (d of days; track $index) {
        <text class="axis" [class.today]="$index === p().today" [attr.x]="x($index + 0.5)" [attr.y]="H - 5" text-anchor="middle">{{ d }}</text>
      }
    </svg>
    <p class="legend"><i class="k pace"></i> ritmo para o alvo <i class="k real"></i> o que já fizeste</p>
  `,
  styles: `
    :host { display: block; --wp-real: var(--ion-color-primary); --wp-text: var(--ion-color-medium); --wp-grid: rgba(127, 127, 127, 0.28); }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 4px; }
    .value { font-size: 1.7rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ion-color-primary); }
    small { font-size: 0.85rem; color: var(--wp-text); }
    .pill { font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
    .pill.ahead { background: rgba(var(--ion-color-success-rgb), 0.16); color: var(--ion-color-success-shade, var(--ion-color-success)); }
    .pill.behind { background: rgba(var(--ion-color-warning-rgb), 0.2); color: var(--ion-color-warning-shade, var(--ion-color-warning)); }
    svg { width: 100%; height: auto; display: block; }
    .base { stroke: var(--wp-grid); stroke-width: 1; }
    .goal { stroke: var(--wp-grid); stroke-width: 1; stroke-dasharray: 2 4; }
    .pace { fill: none; stroke: var(--wp-text); stroke-width: 1.6; stroke-dasharray: 5 4; stroke-linecap: round; opacity: 0.8; }
    .real { fill: none; stroke: var(--wp-real); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
    .area { fill: url(#wp-fill); }
    .dot { fill: var(--wp-real); stroke: var(--ion-background-color, #fff); stroke-width: 2; }
    .now { fill: var(--ion-text-color); font-size: 11px; font-weight: 700; }
    .axis { fill: var(--wp-text); font-size: 10px; }
    .axis.today { fill: var(--ion-text-color); font-weight: 700; }
    .legend { margin: 6px 0 0; font-size: 0.75rem; color: var(--wp-text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .k { display: inline-block; width: 18px; height: 0; border-top: 2px solid var(--wp-real); margin-left: 6px; }
    .k.pace { border-top: 2px dashed var(--wp-text); margin-left: 0; opacity: 0.8; }
  `,
})
export class WeekProgressChartComponent {
  readonly progress = input.required<WeekProgress>();
  readonly p = this.progress;
  readonly W = W;
  readonly H = H;
  readonly M = M;
  readonly days = DAYS;

  private readonly top = computed(() => Math.max(this.p().target, this.p().done, 1) * 1.08);
  n = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 1 });
  x = (v: number) => M.left + (v / 7) * (W - M.left - M.right);
  y = (v: number) => H - M.bottom - (v / this.top()) * (H - M.top - M.bottom);

  readonly pacePts = computed(() => this.p().points.map((q) => `${this.x(q.x).toFixed(1)},${this.y(q.pace).toFixed(1)}`).join(' '));
  private readonly realList = computed(() => this.p().points.filter((q) => q.real !== null && q.x <= this.p().today + 1));
  readonly realPts = computed(() => this.realList().map((q) => `${this.x(q.x).toFixed(1)},${this.y(q.real!).toFixed(1)}`).join(' '));
  readonly area = computed(() => {
    const l = this.realList();
    if (l.length < 2) return '';
    const pts = l.map((q) => `${this.x(q.x).toFixed(1)},${this.y(q.real!).toFixed(1)}`);
    return `M${this.x(0)},${this.y(0)} L${pts.join(' L')} L${this.x(l[l.length - 1].x).toFixed(1)},${this.y(0)} Z`;
  });
  readonly end = computed(() => {
    const l = this.realList();
    const q = l[l.length - 1];
    return q ? { x: this.x(q.x), y: this.y(q.real!) } : null;
  });

  /** Diferença para o ritmo no fim de hoje (séries). */
  readonly delta = computed(() => {
    const q = this.p().points[this.p().today + 1];
    return Math.round(((q.real ?? 0) - q.pace) * 10) / 10;
  });
  readonly status = computed(() => {
    if (this.p().target <= 0) return 'Sem alvo';
    const d = this.delta();
    if (this.p().done >= this.p().target) return 'Alvo cumprido';
    return d >= 0 ? `À frente do ritmo (+${Math.round(d)})` : `Atrás do ritmo (${Math.round(d)})`;
  });
  readonly aria = computed(() => `Alvo da semana: ${this.n(this.p().done)} de ${this.n(this.p().target)} séries. ${this.status()}.`);
}
