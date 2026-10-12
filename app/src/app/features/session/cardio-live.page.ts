import { Component, computed, effect, inject, input, OnDestroy, signal, untracked } from '@angular/core';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar,
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
 * Atividade de cardio ao vivo: botão redondo «Começar», contagem de 5 s a regredir e o tempo corre até parares na app.
 * Ao parar, guarda a duração sem pedir mais nada e pergunta se queres terminar o treino ou adicionar mais exercícios.
 */
@Component({
  selector: 'app-cardio-live',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonButton, IonIcon, StatTilesComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/sessao" text="" /></ion-buttons>
        <ion-title>{{ run()?.name ?? exName() ?? 'Cardio' }}</ion-title>
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
            <div class="dial" [class.done]="targetReached()" aria-live="off">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle class="track" cx="100" cy="100" r="92" />
                <circle class="arc" cx="100" cy="100" r="92" [attr.stroke-dasharray]="ring" [attr.stroke-dashoffset]="ring * (1 - dialFraction())" />
              </svg>
              <div class="inside">
                <span class="lab">{{ targetReached() ? 'Meta atingida' : 'A decorrer' }}</span>
                <span class="time">{{ clock(ph.elapsedSeconds) }}</span>
                @if (target()) { <span class="lab">meta {{ clock(target()!) }}</span> }
              </div>
            </div>
            <app-stat-tiles size="big" [tiles]="tiles()" />
            @if (!hr()) { <p class="note">A frequência cardíaca aparece quando o relógio sincronizar com o Health Connect (pode demorar).</p> }
            @if (profileMissing()) { <p class="note">Para calorias mais certas, preenche {{ missingText() }} no Perfil.</p> }
            <ion-button class="stop" expand="block" size="large" color="danger" (click)="stop()" [disabled]="saving()">
              <ion-icon slot="start" name="stop-circle" /> Parar
            </ion-button>
          }
        } @else {
          <!-- à espera: um botão redondo grande para começar -->
          <h1 class="ex">{{ exName() || 'Cardio' }}</h1>
          <button type="button" class="go" (click)="begin()" [disabled]="!exName()" aria-label="Começar a atividade">
            <span>Começar</span>
          </button>
          <p class="sub">@if (target()) { Meta: {{ clock(target()!) }} · }Toca para começar. Tens 5 segundos para te preparares.</p>
        }
      </div>
    </ion-content>
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
    .dial { position: relative; width: min(84vw, 340px); aspect-ratio: 1; margin: 2vh 0; }
    .dial svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    .dial .arc { transition: stroke-dashoffset 0.4s linear; }
    .dial.done .arc { stroke: var(--ion-color-success); }
    .dial.done .track { stroke: rgba(var(--ion-color-success-rgb), 0.18); }
    .inside { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
    .time { font-size: clamp(3.2rem, 17vw, 4.6rem); font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
    .lab { font-size: 0.85rem; color: var(--ion-color-medium); }
    app-stat-tiles { width: 100%; }
    .note { margin: 0; color: var(--ion-color-medium); font-size: 0.8rem; }
    .stop { width: 100%; margin-top: 8px; --border-radius: 18px; min-height: 64px; font-weight: 700; }
    .ex { margin: 4vh 0 0; font-size: 1.5rem; font-weight: 700; }
    .go { width: min(78vw, 320px); aspect-ratio: 1; margin: 3vh 0; border: 0; border-radius: 50%; cursor: pointer;
      background: var(--ion-color-primary); color: var(--ion-color-primary-contrast, #fff);
      font-size: clamp(1.8rem, 9vw, 2.4rem); font-weight: 800; letter-spacing: 0.01em;
      box-shadow: 0 18px 40px -12px rgba(var(--ion-color-primary-rgb), 0.55), inset 0 0 0 10px rgba(255, 255, 255, 0.12);
      transition: transform 0.12s ease, box-shadow 0.12s ease; }
    .go:active { transform: scale(0.96); }
    .go:disabled { opacity: 0.5; }
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
  /** A corrida em curso, só se for deste exercício. */
  readonly run = computed(() => (this.runs.run()?.exerciseId === this.id() ? this.runs.run() : null));
  readonly exName = signal('');
  private sessionId = '';
  private readonly now = signal(this.clockSvc.now().getTime());
  private readonly ticker = setInterval(() => this.now.set(this.clockSvc.now().getTime()), 250);
  private wake: { release(): Promise<void> } | null = null;
  private hrTimer: ReturnType<typeof setInterval> | null = null;

  readonly phase = computed(() => {
    const r = this.run();
    return r ? phaseOf(r, this.now()) : null;
  });
  /** Meta de duração do exercício no treino (s), se houver. */
  readonly target = signal<number | null>(null);
  readonly targetReached = computed(() => {
    const t = this.target();
    const p = this.phase();
    return !!t && p?.phase === 'running' && p.elapsedSeconds >= t;
  });
  /** Anel: progresso para a meta; sem meta, dá uma volta por minuto. */
  readonly dialFraction = computed(() => {
    const p = this.phase();
    if (p?.phase !== 'running') return 0;
    const t = this.target();
    return t ? Math.min(1, p.elapsedSeconds / t) : (p.elapsedSeconds % 60) / 60;
  });
  readonly hr = signal<{ last: number; avg: number } | null>(null);
  readonly profileMissing = computed(() => this.body.missing().length > 0);
  readonly missingText = computed(() => this.body.missing().join(', '));

  private readonly elapsed = computed(() => {
    const p = this.phase();
    return p?.phase === 'running' ? p.elapsedSeconds : 0;
  });
  private readonly estimate = computed(() => {
    const secs = this.elapsed();
    if (secs <= 0) return null;
    return estimateActiveKcal({
      body: this.body.profile(), totalSeconds: secs, avgHr: this.hr()?.avg ?? null,
      segments: [{ seconds: secs, met: cardioMet(this.exName()) }],
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

  readonly saving = signal(false);
  private clockToRestart = false;

  constructor() {
    addIcons({ stopCircle });
    // Quando a contagem acaba e a atividade começa a sério, o relógio da sessão arranca (se ainda não havia nada registado).
    effect(() => {
      const r = this.run();
      const p = this.phase();
      if (r && p?.phase === 'running' && this.clockToRestart) {
        this.clockToRestart = false;
        untracked(() => void this.restartSessionClock(r.goAtMs));
      }
    });
  }

  async ionViewWillEnter(): Promise<void> {
    this.body.reload();
    const s = await this.repo.getActive();
    const ex = s?.exercises.find((e) => e.id === this.id());
    if (!s || !ex) {
      this.nav.navigateRoot('/sessao');
      return;
    }
    this.sessionId = s.id;
    this.exName.set(ex.exerciseName);
    this.target.set(ex.targetDurationSeconds ?? null);
    // Se a atividade já está a decorrer (voltaste ao ecrã), continua; senão fica à espera do toque em «Começar».
    if (this.run()) {
      void this.keepAwake();
      this.startHrPolling();
    }
  }

  /** Toque em «Começar»: arranca a contagem de 5 s. */
  async begin(): Promise<void> {
    if (!this.exName() || this.run()) return;
    const s = await this.repo.getActive();
    this.clockToRestart = !!s && s.exercises.every((e) => e.sets.length === 0);
    this.runs.begin(this.id(), this.exName());
    void this.keepAwake();
    this.startHrPolling();
  }

  /** Primeira atividade da sessão: o relógio conta a partir daqui e não desde que o treino foi aberto. */
  private async restartSessionClock(goAtMs: number): Promise<void> {
    try {
      if (this.sessionId) await this.repo.restartClock(this.sessionId, new Date(goAtMs).toISOString());
    } catch {
      /* o relógio fica como estava */
    }
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

  /** Cancela a contagem: volta ao botão «Começar». */
  cancel(): void {
    this.runs.clear();
    this.clockToRestart = false;
  }

  /** Parar: guarda a duração (sem pedir mais valores) e pergunta se é para terminar o treino. */
  async stop(): Promise<void> {
    const r = this.run();
    const p = this.phase();
    if (!r || p?.phase !== 'running' || this.saving()) return;
    const seconds = p.elapsedSeconds;
    if (seconds < 1) {
      this.cancel();
      return;
    }
    this.saving.set(true);
    try {
      await this.repo.saveSet({
        sessionExerciseId: r.exerciseId,
        type: 'WORKING',
        entries: [{ side: 'BOTH', durationSeconds: seconds, distanceM: null, caloriesKcal: null }],
      });
      const s = await this.repo.getActive();
      this.runs.clear();
      // Todos os exercícios já têm registo: pergunta se é para terminar ou juntar mais. Senão, volta ao menu do treino.
      const allDone = !!s && s.exercises.every((e) => e.sets.length > 0);
      if (!allDone) {
        await this.toasts.success(`«${r.name}» guardado: ${formatClock(seconds)}.`, 1800);
        this.nav.navigateRoot('/sessao');
        return;
      }
      const choice = await this.askFinishOrAdd(r.name, seconds);
      this.nav.navigateRoot(choice === 'add' ? '/sessao?add=1' : choice === 'finish' ? '/sessao?fim=1' : '/sessao');
    } catch (err) {
      await this.toasts.error(err instanceof Error ? err.message : 'Não foi possível guardar.');
    } finally {
      this.saving.set(false);
    }
  }

  /** «Terminar o treino?»: devolve a escolha, ou 'menu' se fechar sem escolher. */
  private async askFinishOrAdd(name: string, seconds: number): Promise<'finish' | 'add' | 'menu'> {
    let choice: 'finish' | 'add' | 'menu' = 'menu';
    const a = await this.alerts.create({
      header: 'Terminar o treino?',
      message: `«${name}» guardado (${formatClock(seconds)}). Queres adicionar mais exercícios ou terminar o treino?`,
      buttons: [
        { text: 'Adicionar exercício', handler: () => { choice = 'add'; } },
        { text: 'Terminar treino', role: 'confirm', cssClass: 'alert-primary', handler: () => { choice = 'finish'; } },
      ],
    });
    await a.present();
    await a.onDidDismiss();
    return choice;
  }
}
