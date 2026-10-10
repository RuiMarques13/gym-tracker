import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { TimerNotifier } from './timer-notifier';
import { CLOCK } from '../util/clock';
import {
  addSeconds, elapsedSeconds, isFinished, isPaused, pause, progress, remainingSeconds, resume, startTimer,
  TimerKind, TimerState,
} from './timer-math';

export interface TimerFinish {
  seq: number;
  kind: TimerKind;
  label: string;
  /** Segundos que o temporizador tinha (para registar a duração de uma série feita até ao fim). */
  seconds: number;
}

/**
 * Um temporizador de cada vez (descanso ou duração). O estado vive só em memória e não sincroniza.
 * Avisa no fim com som e vibração (conforme as definições) e emite `finished`.
 * Notificação com o ecrã bloqueado precisa de plugin nativo: fica para o Android.
 */
@Injectable({ providedIn: 'root' })
export class TimerService {
  private readonly clock = inject(CLOCK);
  private readonly settings = inject(SettingsService);
  private readonly notifier = inject(TimerNotifier);

  private readonly state = signal<TimerState | null>(null);
  private readonly now = signal(this.clock.now().getTime());
  private handle: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private audio: AudioContext | null = null;
  private dismissHandle: ReturnType<typeof setTimeout> | null = null;
  private alerted = false;

  readonly active = computed(() => this.state() !== null);
  readonly kind = computed(() => this.state()?.kind ?? null);
  readonly label = computed(() => this.state()?.label ?? '');
  readonly paused = computed(() => { const s = this.state(); return s ? isPaused(s) : false; });
  readonly remaining = computed(() => { const s = this.state(); return s ? remainingSeconds(s, this.now()) : 0; });
  readonly total = computed(() => this.state()?.totalSeconds ?? 0);
  readonly progress = computed(() => { const s = this.state(); return s ? progress(s, this.now()) : 0; });
  readonly done = computed(() => { const s = this.state(); return s ? isFinished(s, this.now()) : false; });
  readonly finished = signal<TimerFinish | null>(null);

  constructor() {
    effect(() => {
      if (this.active()) this.ensureTicking();
      else this.stopTicking();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.tick());
    }
  }

  /** Chamar a partir de um gesto do utilizador (toque), para o browser deixar tocar o som no fim. */
  start(kind: TimerKind, label: string, seconds: number): void {
    this.unlockAudio();
    this.clearDismiss();
    this.finished.set(null);
    this.now.set(this.clock.now().getTime());
    this.state.set(startTimer(kind, label, seconds, this.now()));
    this.notify();
  }

  add(seconds: number): void {
    const s = this.state();
    if (!s) return;
    this.now.set(this.clock.now().getTime());
    this.clearDismiss();
    this.state.set(addSeconds(s, seconds, this.now()));
    this.notify();
  }

  togglePause(): void {
    const s = this.state();
    if (!s) return;
    this.now.set(this.clock.now().getTime());
    this.state.set(isPaused(s) ? resume(s, this.now()) : pause(s, this.now()));
    this.notify();
  }

  /** Fecha o temporizador. Devolve os segundos já feitos (útil no cronómetro de duração). */
  stop(): number {
    const s = this.state();
    const done = s ? elapsedSeconds(s, this.clock.now().getTime()) : 0;
    this.clearDismiss();
    this.state.set(null);
    void this.notifier.cancel();
    return done;
  }

  /** Reinicia com o mesmo tempo total. */
  restart(): void {
    const s = this.state();
    if (s) this.start(s.kind, s.label, s.totalSeconds);
  }

  /** Agenda a notificação do fim, ou cancela-a se estiver em pausa. */
  private notify(): void {
    const s = this.state();
    if (!s || isPaused(s)) {
      void this.notifier.cancel();
      return;
    }
    const title = s.kind === 'REST' ? 'Descanso terminado' : 'Tempo cumprido';
    void this.notifier.schedule(new Date(s.endsAt), title, s.label);
  }

  private tick(): void {
    const s = this.state();
    if (!s) return;
    this.now.set(this.clock.now().getTime());
    if (isFinished(s, this.now()) && !this.alerted) {
      this.alerted = true;
      this.onFinish(s);
    }
  }

  private onFinish(s: TimerState): void {
    this.seq++;
    this.finished.set({ seq: this.seq, kind: s.kind, label: s.label, seconds: s.totalSeconds });
    if (this.settings.get('timerVibrate')() && typeof navigator !== 'undefined') navigator.vibrate?.([250, 120, 250, 120, 400]);
    if (this.settings.get('timerSound')()) this.beep();
    // O descanso fecha sozinho; o cronómetro de duração fica até a série ser registada.
    void this.notifier.cancel(); // já avisámos dentro da app
    if (s.kind === 'REST') {
      this.dismissHandle = setTimeout(() => {
        if (this.state() === s) this.state.set(null);
      }, 8000);
    }
  }

  private ensureTicking(): void {
    this.alerted = false;
    if (this.handle) return;
    this.handle = setInterval(() => this.tick(), 250);
  }
  private stopTicking(): void {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }
  private clearDismiss(): void {
    if (this.dismissHandle) clearTimeout(this.dismissHandle);
    this.dismissHandle = null;
    this.alerted = false;
  }

  private unlockAudio(): void {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.audio ??= new Ctor();
      void this.audio.resume();
    } catch { /* sem áudio: só vibra */ }
  }

  private beep(): void {
    try {
      const ctx = this.audio;
      if (!ctx) return;
      const t0 = ctx.currentTime;
      for (const [i, freq] of [880, 880, 1175].entries()) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.28);
        gain.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.28 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + i * 0.28);
        osc.stop(t0 + i * 0.28 + 0.25);
      }
    } catch { /* ignora */ }
  }
}
