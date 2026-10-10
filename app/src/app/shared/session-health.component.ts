import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { heartOutline } from 'ionicons/icons';
import { HealthService } from '../core/health/health.service';
import type { SessionHealth } from '../data/repositories/health.repository';
import type { HrPoint } from '../core/health/health.logic';

/** Frequência cardíaca e calorias de um treino, importadas do relógio via Health Connect. */
@Component({
  selector: 'app-session-health',
  imports: [IonButton, IonIcon, IonSpinner],
  template: `
    @if (available()) {
      <section class="card">
        <header><ion-icon name="heart-outline" /> Relógio</header>
        @if (health(); as h) {
          <div class="stats">
            @if (h.avg !== null) { <div><b>{{ h.avg }}</b><span>bpm médio</span></div> }
            @if (h.max !== null) { <div><b>{{ h.max }}</b><span>máximo</span></div> }
            @if (h.min !== null) { <div><b>{{ h.min }}</b><span>mínimo</span></div> }
            @if (h.caloriesKcal !== null) { <div><b>{{ h.caloriesKcal }}</b><span>kcal ativas</span></div> }
          </div>
          @if (path(); as p) {
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="Frequência cardíaca ao longo do treino">
              <polyline [attr.points]="p" />
            </svg>
          }
        } @else {
          <p class="hint">Importa a frequência cardíaca e as calorias deste treino do teu Galaxy Watch.</p>
        }
        @if (message()) { <p class="msg">{{ message() }}</p> }
        <ion-button size="small" fill="outline" (click)="run()" [disabled]="busy()">
          @if (busy()) { <ion-spinner name="dots" /> } @else { {{ health() ? 'Atualizar do relógio' : 'Importar do relógio' }} }
        </ion-button>
      </section>
    }
  `,
  styles: `
    .card { margin: 8px 0; padding: 12px; border-radius: 12px; background: var(--ion-color-light); }
    header { font-weight: 600; display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; }
    .stats div { display: flex; flex-direction: column; }
    .stats b { font-size: 1.3rem; }
    .stats span, .hint { font-size: 0.78rem; color: var(--ion-color-medium); }
    svg { width: 100%; height: 48px; margin-top: 8px; }
    polyline { fill: none; stroke: var(--ion-color-danger); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .msg { font-size: 0.85rem; margin: 6px 0; }
  `,
})
export class SessionHealthComponent {
  private readonly service = inject(HealthService);
  readonly sessionId = input.required<string>();
  readonly startedAt = input.required<string>();
  readonly endedAt = input.required<string | null>();

  readonly available = signal(false);
  readonly health = signal<SessionHealth | null>(null);
  readonly points = signal<HrPoint[]>([]);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);

  readonly path = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return null;
    const t0 = Date.parse(pts[0].ts), span = Math.max(1, Date.parse(pts[pts.length - 1].ts) - t0);
    const lo = Math.min(...pts.map((p) => p.bpm)), hi = Math.max(...pts.map((p) => p.bpm), lo + 1);
    return pts.map((p) => `${(((Date.parse(p.ts) - t0) / span) * 100).toFixed(1)},${(28 - ((p.bpm - lo) / (hi - lo)) * 26).toFixed(1)}`).join(' ');
  });

  constructor() {
    addIcons({ heartOutline });
    effect(() => {
      const id = this.sessionId();
      void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    this.available.set((await this.service.availability()).available);
    this.health.set(await this.service.summary(id));
    this.points.set(await this.service.points(id));
  }

  async run(): Promise<void> {
    this.busy.set(true);
    this.message.set(null);
    try {
      const r = await this.service.importForSession({ id: this.sessionId(), startedAt: this.startedAt(), endedAt: this.endedAt() });
      if (r.ok) {
        this.health.set(r.health);
        this.points.set(await this.service.points(this.sessionId()));
      } else this.message.set(r.reason);
    } catch (err) {
      this.message.set(err instanceof Error ? err.message : 'Não foi possível importar.');
    } finally {
      this.busy.set(false);
    }
  }
}
