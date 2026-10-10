import { Component, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close, pause, play, refresh, remove, add } from 'ionicons/icons';
import { formatClock } from '../core/timer/timer-math';
import { TimerService } from '../core/timer/timer.service';

const SIZE = 68;
const MARGIN = 10;
const STORAGE_KEY = 'gt.timerBubble';

/**
 * Bolha redonda do temporizador: anel de progresso, arrastável, encaixa na borda esquerda ou direita.
 * Toque para abrir os controlos (pausar, ±15 s, reiniciar, saltar).
 */
@Component({
  selector: 'app-timer-bubble',
  imports: [IonIcon],
  template: `
    @if (timer.active()) {
      <div
        class="bubble"
        [class.done]="timer.done()"
        [class.work]="timer.kind() === 'WORK'"
        [class.dragging]="dragging()"
        [style.left.px]="x()"
        [style.top.px]="y()"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="up($event)"
        role="timer"
        [attr.aria-label]="(timer.kind() === 'REST' ? 'Descanso ' : 'Cronómetro ') + clock()"
      >
        <svg viewBox="0 0 68 68" aria-hidden="true">
          <circle class="track" cx="34" cy="34" r="30" />
          <circle class="ring" cx="34" cy="34" r="30" [attr.stroke-dasharray]="circumference"
            [attr.stroke-dashoffset]="circumference * (1 - timer.progress())" />
        </svg>
        <span class="time">{{ clock() }}</span>
      </div>

      @if (open()) {
        <div class="backdrop" (click)="open.set(false)"></div>
        <div class="panel" [style.left.px]="panelX()" [style.top.px]="panelY()">
          <div class="head">
            <span class="kind">{{ timer.kind() === 'REST' ? 'Descanso' : 'A fazer' }}</span>
            <span class="label">{{ timer.label() }}</span>
          </div>
          <div class="big" [class.done]="timer.done()">{{ timer.done() ? 'Acabou!' : clock() }}</div>
          <div class="row">
            <button type="button" (click)="timer.add(-15)" aria-label="Menos 15 segundos"><ion-icon name="remove" />15</button>
            <button type="button" class="main" (click)="timer.togglePause()" [attr.aria-label]="timer.paused() ? 'Retomar' : 'Pausar'">
              <ion-icon [name]="timer.paused() ? 'play' : 'pause'" />
            </button>
            <button type="button" (click)="timer.add(15)" aria-label="Mais 15 segundos"><ion-icon name="add" />15</button>
          </div>
          <div class="row">
            <button type="button" (click)="timer.restart()"><ion-icon name="refresh" /> Reiniciar</button>
            <button type="button" (click)="skip()"><ion-icon name="close" /> {{ timer.kind() === 'REST' ? 'Saltar' : 'Parar' }}</button>
          </div>
        </div>
      }
    }
  `,
  styles: `
    .bubble {
      position: fixed; z-index: 30000; width: 68px; height: 68px; border-radius: 50%;
      background: var(--ion-color-primary); color: var(--ion-color-primary-contrast);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3); display: grid; place-items: center;
      touch-action: none; user-select: none; cursor: grab; transition: left 0.18s ease, top 0.18s ease;
    }
    .bubble.dragging { transition: none; cursor: grabbing; }
    .bubble.work { background: var(--ion-color-secondary, #3880ff); }
    .bubble.done { background: var(--ion-color-success); animation: pulse 0.9s ease-in-out infinite; }
    svg { position: absolute; inset: 0; transform: rotate(-90deg); }
    .track { fill: none; stroke: rgba(255, 255, 255, 0.25); stroke-width: 5; }
    .ring { fill: none; stroke: #fff; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset 0.25s linear; }
    .time { position: relative; font-weight: 700; font-size: 1.05rem; font-variant-numeric: tabular-nums; }
    @keyframes pulse { 50% { transform: scale(1.1); } }
    .backdrop { position: fixed; inset: 0; z-index: 29999; }
    .panel {
      position: fixed; z-index: 30001; width: 248px; padding: 14px; border-radius: 16px;
      background: var(--ion-background-color, #fff); color: var(--ion-text-color, #000);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); display: grid; gap: 10px;
    }
    .head { display: flex; gap: 8px; align-items: baseline; justify-content: space-between; }
    .kind { font-size: 0.75rem; font-weight: 700; text-transform: none; color: var(--ion-color-primary); }
    .label { font-size: 0.85rem; color: var(--ion-color-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .big { font-size: 2.6rem; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; }
    .big.done { color: var(--ion-color-success); }
    .row { display: flex; gap: 8px; }
    button {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 10px 6px;
      border: 0; border-radius: 10px; font: inherit; font-weight: 600; cursor: pointer;
      background: var(--ion-color-step-100, #eee); color: inherit;
    }
    button.main { flex: 0 0 64px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); font-size: 1.3rem; }
  `,
})
export class TimerBubbleComponent {
  readonly timer = inject(TimerService);
  readonly circumference = 2 * Math.PI * 30;

  readonly open = signal(false);
  readonly dragging = signal(false);
  readonly x = signal(this.initial().x);
  readonly y = signal(this.initial().y);
  readonly clock = computed(() => formatClock(this.timer.remaining()));
  readonly panelX = computed(() => Math.min(Math.max(8, this.x() - 90), this.viewport().w - 248 - 8));
  readonly panelY = computed(() => Math.max(8, Math.min(this.y() - 190, this.viewport().h - 220)));

  private readonly viewport = signal({ w: window.innerWidth, h: window.innerHeight });
  private start: { px: number; py: number; x: number; y: number; moved: boolean } | null = null;

  constructor() {
    addIcons({ close, pause, play, refresh, remove, add });
    window.addEventListener('resize', () => {
      this.viewport.set({ w: window.innerWidth, h: window.innerHeight });
      this.x.set(this.snapX(this.x()));
      this.y.set(this.clampY(this.y()));
    });
  }

  down(ev: PointerEvent): void {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.start = { px: ev.clientX, py: ev.clientY, x: this.x(), y: this.y(), moved: false };
  }

  move(ev: PointerEvent): void {
    if (!this.start) return;
    const dx = ev.clientX - this.start.px;
    const dy = ev.clientY - this.start.py;
    if (!this.start.moved && Math.hypot(dx, dy) < 6) return;
    this.start.moved = true;
    this.dragging.set(true);
    this.x.set(Math.min(Math.max(0, this.start.x + dx), this.viewport().w - SIZE));
    this.y.set(this.clampY(this.start.y + dy));
  }

  up(ev: PointerEvent): void {
    const s = this.start;
    this.start = null;
    if (!s) return;
    this.dragging.set(false);
    if (s.moved) {
      this.x.set(this.snapX(this.x()));
      this.save();
    } else if (ev.type === 'pointerup') {
      this.open.update((o) => !o);
    }
  }

  skip(): void {
    this.open.set(false);
    this.timer.stop();
  }

  private snapX(x: number): number {
    const w = this.viewport().w;
    return x + SIZE / 2 < w / 2 ? MARGIN : w - SIZE - MARGIN;
  }
  private clampY(y: number): number {
    return Math.min(Math.max(MARGIN, y), this.viewport().h - SIZE - MARGIN);
  }
  private initial(): { x: number; y: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { left: boolean; yr: number } | null;
      if (saved) return { x: saved.left ? MARGIN : w - SIZE - MARGIN, y: Math.min(Math.max(MARGIN, saved.yr * h), h - SIZE - MARGIN) };
    } catch { /* sem armazenamento */ }
    return { x: w - SIZE - MARGIN, y: h - SIZE - 100 };
  }
  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: this.x() < this.viewport().w / 2, yr: this.y() / this.viewport().h }));
    } catch { /* sem armazenamento */ }
  }
}
