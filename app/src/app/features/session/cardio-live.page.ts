import { Component, computed, effect, inject, input, OnDestroy, signal, untracked } from '@angular/core';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonModal, IonTitle, IonToolbar,
  NavController, ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { stopCircle } from 'ionicons/icons';
import { BodyProfileService } from '../../core/health/body-profile.service';
import { cardioMet, estimateActiveKcal } from '../../core/health/calories';
import { HealthService } from '../../core/health/health.service';
import { CardioRunService } from '../../core/timer/cardio-run.service';
import { phaseOf } from '../../core/timer/cardio-run';
import { formatClock } from '../../core/timer/timer-math';
import { CLOCK } from '../../core/util/clock';
import { ToastService } from '../../core/ui/toast.service';
import { SESSION_REPOSITORY } from '../../data/repositories/providers';
import { StatTile, StatTilesComponent } from '../../shared/stat-tiles.component';

const RING = 2 * Math.PI * 92;

/**
 * Atividade de cardio ao vivo: contagem de 5 s a regredir, depois o tempo corre até parares na app.
 * Ao parar, guarda a série (duração, distância, calorias) e volta ao menu do treino.
 */
@Component({
  selector: 'app-cardio-live',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonButton, IonIcon, IonModal, IonInput, StatTilesComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/sessao" text="" /></ion-buttons>
        <ion-title>{{ run()?.name ?? 'Cardio' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        @if (phase(); as ph) {
          @if (ph.phase === 'countdown') {
            <div class="count" aria-live="assertive">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle class="track" cx="100" cy="100" r="92" />
                <circle class="arc" cx="100" cy="100" r="92" [attr.stroke-dasharray]="ring" [attr.stroke-dashoffset]="ring * (1 - ph.fraction)" />
              </svg>
              <span class="n">{{ ph.remaining }}</span>
            </div>
            <p class="sub">Prepara-te…</p>
            <ion-button fill="clear" color="medium" (click)="cancel()">Cancelar</ion-button>
          } @else {
            <p class="sub">A decorrer</p>
            <div class="clock" aria-live="off">{{ clock(ph.elapsedSeconds) }}</div>
            <app-stat-tiles size="big" [tiles]="tiles()" />
            @if (!hr()) { <p class="note">A frequência cardíaca aparece quando o relógio sincronizar com o Health Connect (pode demorar).</p> }
            @if (profileMissing()) { <p class="note">Para calorias mais certas, preenche {{ missingText() }} no Perfil.</p> }
            <ion-button class="stop" expand="block" size="large" color="danger" (click)="stop()">
              <ion-icon slot="start" name="stop-circle" /> Parar
            </ion-button>
          }
        } @else {
          <p class="sub">A preparar…</p>
        }
      </div>
    </ion-content>

    <ion-modal [isOpen]="finishOpen()" (didDismiss)="finishOpen.set(false)" [initialBreakpoint]="0.62" [breakpoints]="[0, 0.62, 1]">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Terminar atividade</ion-title>
            <ion-buttons slot="end"><ion-button (click)="finishOpen.set(false)">Continuar</ion-button></ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div class="sheet">
            <p class="sheet-sub">{{ clock(frozen()) }} · {{ run()?.name }}</p>
            <div class="fields">
              <ion-input label="Distância (km)" labelPlacement="stacked" fill="outline" type="number" inputmode="decimal"
                [value]="distance()" (ionInput)="distance.set($any($event).detail.value ?? '')" />
              <ion-input label="Calorias (kcal)" labelPlacement="stacked" fill="outline" type="number" inputmode="numeric"
                [value]="kcal()" (ionInput)="kcal.set($any($event).detail.value ?? '')" />
            </div>
            <p class="note">Calorias propostas por estimativa. Se o relógio as enviar depois, o valor dele aparece nos detalhes.</p>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <ion-button expand="block" (click)="save()" [disabled]="saving()">Guardar</ion-button>
            <ion-button expand="block" fill="clear" color="danger" (click)="discard()">Descartar atividade</ion-button>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .page { max-width: 520px; margin: 0 auto; padding: 16px 16px 32px; display: grid; gap: 16px; justify-items: center; text-align: center; }
    .count { position: relative; width: min(72vw, 300px); aspect-ratio: 1; margin-top: 8vh; }
    .count svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    .track { fill: none; stroke: rgba(var(--ion-color-primary-rgb), 0.15); stroke-width: 10; }
    .arc { fill: none; stroke: var(--ion-color-primary); stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 0.25s linear; }
    .n { position: absolute; inset: 0; display: grid; place-items: center; font-size: clamp(5rem, 28vw, 8rem); font-weight: 800;
      color: var(--ion-color-primary); font-variant-numeric: tabular-nums; }
    .sub { margin: 0; color: var(--ion-color-medium); font-size: 1rem; }
    .clock { font-size: clamp(3.4rem, 18vw, 5rem); font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
    app-stat-tiles { width: 100%; }
    .note { margin: 0; color: var(--ion-color-medium); font-size: 0.8rem; }
    .stop { width: 100%; margin-top: 8px; --border-radius: 18px; min-height: 64px; font-weight: 700; }
    .sheet { padding: 12px 16px 24px; display: grid; gap: 14px; max-width: 520px; margin: 0 auto; }
    .sheet-sub { margin: 0; color: var(--ion-color-medium); }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
    .error { margin: 0; color: var(--ion-color-danger); font-size: 0.9rem; }
  `,
})
export class CardioLivePage implements ViewWillEnter, OnDestroy {
  /** Id do exercício na sessão (rota /sessao/cardio/:id). */
  readonly id = input.required<string>();

  private readonly runs = inject(CardioRunService);
  private readonly clockSvc = inject(CLOCK);
  private readonly repo = inject(SESSION_REPOSITORY);
  private readonly nav = inject(NavController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastService);
  private readonly body = inject(BodyProfileService);
  private readonly health = inject(HealthService);

  readonly ring = RING;
  readonly clock = formatClock;
  readonly run = this.runs.run;
  private readonly now = signal(this.clockSvc.now().getTime());
  private readonly ticker = setInterval(() => this.now.set(this.clockSvc.now().getTime()), 250);
  private wake: { release(): Promise<void> } | null = null;
  private hrTimer: ReturnType<typeof setInterval> | null = null;

  readonly phase = computed(() => {
    const r = this.run();
    return r ? phaseOf(r, this.now()) : null;
  });
  readonly hr = signal<{ last: number; avg: number } | null>(null);
  readonly profileMissing = computed(() => this.body.missing().length > 0);
  readonly missingText = computed(() => this.body.missing().join(', '));

  private readonly name = signal('');
  private readonly elapsed = computed(() => {
    const p = this.phase();
    return p?.phase === 'running' ? p.elapsedSeconds : 0;
  });
  private readonly estimate = computed(() => {
    const secs = this.elapsed();
    if (secs <= 0) return null;
    return estimateActiveKcal({
      body: this.body.profile(), totalSeconds: secs, avgHr: this.hr()?.avg ?? null,
      segments: [{ seconds: secs, met: cardioMet(this.name()) }],
    });
  });
  readonly tiles = computed<StatTile[]>(() => {
    const e = this.estimate();
    const hr = this.hr();
    return [
      { label: 'Calorias', value: e ? String(e.kcal) : '—', unit: e ? 'kcal' : undefined, tone: 'danger', hint: e ? 'estimado' : 'falta o peso no Perfil' },
      { label: 'Freq. cardíaca', value: hr ? String(hr.last) : '—', unit: hr ? 'bpm' : undefined, tone: 'tertiary', hint: hr ? `média ${hr.avg}` : undefined },
    ];
  });

  // painel de terminar
  readonly finishOpen = signal(false);
  readonly frozen = signal(0);
  readonly distance = signal('');
  readonly kcal = signal('');
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
    addIcons({ stopCircle });
    // O nome só vive na corrida guardada; mantém-no à mão para o cálculo das calorias.
    effect(() => {
      const r = this.run();
      untracked(() => this.name.set(r?.name ?? ''));
    });
  }

  async ionViewWillEnter(): Promise<void> {
    this.body.reload();
    if (!this.run() || this.run()!.exerciseId !== this.id()) {
      const s = await this.repo.getActive();
      const ex = s?.exercises.find((e) => e.id === this.id());
      if (!s || !ex) {
        this.nav.navigateRoot('/sessao');
        return;
      }
      this.runs.begin(ex.id, ex.exerciseName);
    }
    void this.keepAwake();
    this.startHrPolling();
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
    if (this.hrTimer) clearInterval(this.hrTimer);
    void this.wake?.release().catch(() => undefined);
  }

  /** Mantém o ecrã ligado enquanto a atividade corre (se o sistema deixar). */
  private async keepAwake(): Promise<void> {
    try {
      const api = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
      this.wake = (await api?.request('screen')) ?? null;
    } catch {
      /* sem wake lock: o ecrã apaga-se como de costume */
    }
  }

  private startHrPolling(): void {
    if (this.hrTimer) return;
    const poll = async () => {
      const r = this.run();
      if (!r || phaseOf(r, this.clockSvc.now().getTime()).phase !== 'running') return;
      const v = await this.health.liveHeartRate(new Date(r.goAtMs).toISOString());
      if (v) this.hr.set(v);
    };
    this.hrTimer = setInterval(() => void poll(), 20_000);
  }

  cancel(): void {
    this.runs.clear();
    this.nav.navigateBack('/sessao');
  }

  stop(): void {
    const p = this.phase();
    if (p?.phase !== 'running') return;
    this.frozen.set(p.elapsedSeconds);
    const e = this.estimate();
    this.kcal.set(e && e.kcal > 0 ? String(e.kcal) : '');
    this.distance.set('');
    this.error.set(null);
    this.finishOpen.set(true);
  }

  async save(): Promise<void> {
    const r = this.run();
    if (!r || this.saving()) return;
    const km = this.distance().trim() === '' ? null : Number(this.distance().replace(',', '.'));
    const kc = this.kcal().trim() === '' ? null : Number(this.kcal().replace(',', '.'));
    if ((km !== null && (!Number.isFinite(km) || km < 0)) || (kc !== null && (!Number.isFinite(kc) || kc < 0))) {
      this.error.set('Confirma a distância e as calorias: têm de ser números.');
      return;
    }
    this.saving.set(true);
    try {
      await this.repo.saveSet({
        sessionExerciseId: r.exerciseId,
        type: 'WORKING',
        entries: [{ side: 'BOTH', durationSeconds: this.frozen(), distanceM: km === null ? null : Math.round(km * 1000), caloriesKcal: kc === null ? null : Math.round(kc) }],
      });
      const s = await this.repo.getActive();
      this.runs.clear();
      this.finishOpen.set(false);
      await this.toasts.success(`«${r.name}» guardado: ${formatClock(this.frozen())}.`, 1800);
      // Só este exercício: vai direto a terminar a sessão. Com mais exercícios, volta ao menu do treino.
      const only = (s?.exercises.length ?? 0) <= 1;
      this.nav.navigateRoot(only ? '/sessao?fim=1' : '/sessao');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Não foi possível guardar.');
    } finally {
      this.saving.set(false);
    }
  }

  async discard(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Descartar a atividade?',
      message: 'O tempo desta atividade não fica guardado.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Descartar', role: 'destructive', handler: () => { this.runs.clear(); this.finishOpen.set(false); this.nav.navigateRoot('/sessao'); } },
      ],
    });
    await a.present();
  }
}
