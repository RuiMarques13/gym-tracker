import { Component, computed, input, signal } from '@angular/core';
import { formatNumber, lineDomain, niceScale } from './chart-math';

export interface ChartPoint {
  /** Rótulo curto do eixo x (ex.: «5 out»). */
  label: string;
  /** Rótulo completo para o aviso e a tabela (ex.: «Semana de 5 out»). */
  full: string;
  value: number;
}

const W = 360;
const H = 200;
const M = { left: 36, right: 10, top: 10, bottom: 24 };

/**
 * Gráfico de uma série, em SVG: barras (começam em zero) ou linha (não força o zero).
 * Marcas finas, grelha discreta, valor ao tocar/passar o rato e vista em tabela para quem não vê cores.
 */
@Component({
  selector: 'app-chart',
  template: `
    <div class="head">
      <div class="readout" aria-live="polite">
        @if (active(); as a) {
          <strong>{{ fmt(a.value) }}{{ unit() }}</strong> <span>{{ a.full }}</span>
        } @else if (points().length) {
          <span class="hint">Toca num ponto para ver o valor</span>
        }
      </div>
      @if (points().length) {
        <button type="button" class="toggle" (click)="asTable.set(!asTable())">{{ asTable() ? 'Ver gráfico' : 'Ver tabela' }}</button>
      }
    </div>

    @if (!points().length) {
      <p class="empty">{{ empty() }}</p>
    } @else if (asTable()) {
      <table>
        <tbody>
          @for (p of points(); track $index) {
            <tr><th scope="row">{{ p.full }}</th><td>{{ fmt(p.value) }}{{ unit() }}</td></tr>
          }
        </tbody>
      </table>
    } @else {
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="ariaLabel()" (pointerleave)="activeIndex.set(null)">
        @for (t of ticks(); track t.value) {
          <line class="grid" [attr.x1]="M.left" [attr.x2]="W - M.right" [attr.y1]="t.y" [attr.y2]="t.y" />
          <text class="axis" [attr.x]="M.left - 6" [attr.y]="t.y + 3.5" text-anchor="end">{{ fmt(t.value) }}</text>
        }
        @for (l of xLabels(); track l.i) {
          <text class="axis" [attr.x]="l.x" [attr.y]="H - 6" text-anchor="middle">{{ l.text }}</text>
        }
        @if (kind() === 'bar') {
          @for (b of bars(); track $index) {
            @if (b.h > 0) {
              <path class="mark" [class.on]="activeIndex() === $index" [attr.d]="b.d" />
            } @else {
              <rect class="zero" [attr.x]="b.x" [attr.y]="H - M.bottom - 1" [attr.width]="b.w" height="1" />
            }
          }
        } @else {
          <polyline class="line" [attr.points]="linePoints()" />
          @for (d of dots(); track $index) {
            <circle class="dot" [class.on]="activeIndex() === $index" [attr.cx]="d.x" [attr.cy]="d.y" [attr.r]="activeIndex() === $index ? 5.5 : 4" />
          }
        }
        <!-- alvos de toque: mais largos que a marca -->
        @for (s of slots(); track $index) {
          <rect class="hit" [attr.x]="s.x" [attr.y]="M.top" [attr.width]="s.w" [attr.height]="H - M.top - M.bottom"
            (pointerenter)="activeIndex.set($index)" (pointerdown)="activeIndex.set($index)" />
        }
      </svg>
    }
  `,
  styles: `
    :host {
      display: block;
      --viz-series: #0f766e;
      --viz-grid: rgba(0, 0, 0, 0.1);
      --viz-text: #52514e;
      --viz-surface: #ffffff;
    }
    :host-context(.ion-palette-dark) {
      --viz-series: #2cb5a8;
      --viz-grid: rgba(255, 255, 255, 0.14);
      --viz-text: #c3c2b7;
      --viz-surface: #1e1e1e;
    }
    .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; min-height: 28px; }
    .readout { font-size: 0.9rem; color: var(--viz-text); }
    .readout strong { color: var(--ion-text-color); font-size: 1.1rem; margin-right: 8px; }
    .hint { font-size: 0.8rem; }
    .toggle { background: none; border: 0; color: var(--ion-color-primary); font: inherit; font-size: 0.85rem; padding: 6px 0; cursor: pointer; }
    svg { width: 100%; height: auto; display: block; touch-action: pan-y; }
    .grid { stroke: var(--viz-grid); stroke-width: 1; }
    .axis { fill: var(--viz-text); font-size: 10px; }
    .mark { fill: var(--viz-series); opacity: 0.9; }
    .mark.on { opacity: 1; }
    .zero { fill: var(--viz-grid); }
    .line { fill: none; stroke: var(--viz-series); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .dot { fill: var(--viz-series); stroke: var(--viz-surface); stroke-width: 2; }
    .hit { fill: transparent; cursor: pointer; }
    .empty { color: var(--viz-text); font-size: 0.9rem; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { padding: 6px 0; border-bottom: 1px solid var(--viz-grid); text-align: left; font-weight: normal; }
    td { text-align: right; font-variant-numeric: tabular-nums; }
  `,
})
export class ChartComponent {
  readonly points = input.required<ChartPoint[]>();
  readonly kind = input<'bar' | 'line'>('bar');
  readonly unit = input('');
  readonly empty = input('Ainda sem dados.');
  readonly label = input('');

  readonly W = W;
  readonly H = H;
  readonly M = M;
  readonly asTable = signal(false);
  readonly activeIndex = signal<number | null>(null);
  readonly active = computed(() => {
    const i = this.activeIndex();
    return i === null ? null : (this.points()[i] ?? null);
  });
  fmt = formatNumber;

  private readonly plot = { w: W - M.left - M.right, h: H - M.top - M.bottom };

  private readonly domain = computed(() => {
    const v = this.points().map((p) => p.value);
    if (this.kind() === 'bar') {
      const s = niceScale(Math.max(0, ...v));
      return { min: 0, max: s.max, step: s.step };
    }
    const d = lineDomain(v);
    const s = niceScale(d.max - d.min, 3);
    const min = Math.floor(d.min / s.step) * s.step;
    return { min, max: Math.ceil(d.max / s.step) * s.step, step: s.step };
  });

  private y = (v: number) => {
    const d = this.domain();
    return M.top + this.plot.h - ((v - d.min) / (d.max - d.min || 1)) * this.plot.h;
  };

  readonly ticks = computed(() => {
    const d = this.domain();
    const out: Array<{ value: number; y: number }> = [];
    for (let v = d.min; v <= d.max + d.step / 2; v += d.step) out.push({ value: Math.round(v * 100) / 100, y: this.y(v) });
    return out;
  });

  readonly slots = computed(() => {
    const n = this.points().length;
    const w = this.plot.w / Math.max(n, 1);
    return Array.from({ length: n }, (_, i) => ({ x: M.left + i * w, w, cx: M.left + i * w + w / 2 }));
  });

  readonly bars = computed(() =>
    this.slots().map((s, i) => {
      const w = Math.min(s.w * 0.62, 28);
      const x = s.cx - w / 2;
      const top = this.y(this.points()[i].value);
      const base = H - M.bottom;
      const h = base - top;
      const r = Math.min(4, w / 2, h);
      // topo arredondado (4 px), base reta no eixo
      const d = `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
      return { x, w, h, d };
    }),
  );

  readonly dots = computed(() => this.slots().map((s, i) => ({ x: s.cx, y: this.y(this.points()[i].value) })));
  readonly linePoints = computed(() => this.dots().map((d) => `${d.x},${d.y}`).join(' '));

  /** No máximo ~6 rótulos no eixo x, sempre incluindo o primeiro e o último. */
  readonly xLabels = computed(() => {
    const slots = this.slots();
    const every = Math.max(1, Math.ceil(slots.length / 6));
    const out: Array<{ i: number; x: number; text: string }> = [];
    slots.forEach((slot, i) => {
      if (i % every === 0) out.push({ i, x: slot.cx, text: this.points()[i].label });
    });
    const last = slots.length - 1;
    if (last >= 0 && (out.at(-1)?.i ?? -1) !== last && last - (out.at(-1)?.i ?? -1) >= Math.ceil(every / 2) + 1) {
      out.push({ i: last, x: slots[last].cx, text: this.points()[last].label });
    }
    return out;
  });

  readonly ariaLabel = computed(() => {
    const p = this.points();
    if (!p.length) return this.label();
    const vals = p.map((x) => x.value);
    return `${this.label()}: ${p.length} pontos, de ${formatNumber(Math.min(...vals))} a ${formatNumber(Math.max(...vals))}${this.unit()}`;
  });
}
