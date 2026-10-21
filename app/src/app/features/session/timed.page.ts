import { Component, computed, inject, input, OnDestroy, signal } from '@angular/core';
import { IonContent, IonSpinner, NavController, ViewWillEnter } from '@ionic/angular';
import { GROUP_LABEL, groupLabel, phaseAt, planSeconds, roundsDone, timedPlan, type GroupConfig, type Phase } from '../../core/session/group-format';
import type { GroupResult } from '../../data/models/group';
import type { SessionExercise } from '../../data/models/session';
import { GROUP_REPOSITORY, SESSION_REPOSITORY } from '../../services/repositories';
import { TimerNotifier } from '../../services/timer/timer-notifier';
import { TimerService } from '../../services/timer/timer.service';
import { HapticsService } from '../../services/ui/haptics.service';

const RING = 2 * Math.PI * 108;

/**
 * Treino por tempo (Tabata, EMOM, AMRAP, intervalos) de um grupo da sessão em curso: ecrã inteiro, verde no trabalho,
 * laranja no descanso, bips e vibração em cada troca e notificações agendadas para o ecrã bloqueado. O relógio conta
 * pela hora de início (não por tiques), por isso não se atrasa com a app em segundo plano. No fim guarda as rondas
 * ou voltas no grupo da sessão (não entram nas séries por músculo; rules.ts `groups.volume`).
 */
@Component({
  selector: 'app-timed',
  imports: [IonContent, IonSpinner],
  template: `
    <ion-content [class]="'phase-' + phaseClass()">
      @if (!cfg()) {
        <div class="center"><ion-spinner /></div>
      } @else if (step() === 'result') {
        <div class="page result">
          <h1>Feito!</h1>
          <p class="sub">{{ title() }}</p>
          @if (cfg()!.kind === 'AMRAP') {
            <div class="field"><span>Voltas</span>
              <button type="button" class="step" aria-label="Menos uma volta" (click)="rounds.set(max0(rounds() - 1))">−</button>
              <strong aria-live="polite">{{ rounds() }}</strong>
              <button type="button" class="step" aria-label="Mais uma volta" (click)="rounds.set(rounds() + 1)">+</button>
            </div>
            <div class="field"><span>Repetições a mais</span>
              <button type="button" class="step" aria-label="Menos uma repetição" (click)="extra.set(max0(extra() - 1))">−</button>
              <strong aria-live="polite">{{ extra() }}</strong>
              <button type="button" class="step" aria-label="Mais uma repetição" (click)="extra.set(extra() + 1)">+</button>
            </div>
          } @else {
            <div class="field"><span>Rondas feitas</span>
              <button type="button" class="step" aria-label="Menos uma ronda" (click)="rounds.set(max0(rounds() - 1))">−</button>
              <strong aria-live="polite">{{ rounds() }}</strong>
              <button type="button" class="step" aria-label="Mais uma ronda" (click)="rounds.set(rounds() + 1)">+</button>
            </div>
          }
          @if (last(); as l) { <p class="last">Da última vez: {{ resultText(l) }}</p> }
          <button type="button" class="go" (click)="save()">GUARDAR</button>
          <button type="button" class="link" (click)="back()">Sair sem guardar</button>
        </div>
      } @else {
        <div class="page">
          <header class="top">
            <button type="button" class="x" aria-label="Sair" (click)="back()">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <span class="cfg">{{ title() }}</span>
          </header>
          <h1 class="phase">{{ phaseLabel() }}</h1>
          <div class="ring">
            <svg viewBox="0 0 250 250" width="250" height="250" aria-hidden="true">
              <circle cx="125" cy="125" r="108" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="22" />
              <circle class="arc" cx="125" cy="125" r="108" fill="none" stroke="currentColor" stroke-width="22" stroke-linecap="round"
                [attr.stroke-dasharray]="dash()" transform="rotate(-90 125 125)" />
            </svg>
            <div class="clock" role="timer" [attr.aria-label]="phaseLabel() + ' ' + clock()">
              <span class="big">{{ clock() }}</span>
              <span class="round">{{ roundLabel() }}</span>
            </div>
          </div>
          <section class="now">
            <div class="ex">{{ exerciseNow() }}</div>
            <div class="next">{{ nextLabel() }}</div>
          </section>
          @if (last(); as l) { <p class="last">Da última vez: {{ resultText(l) }}</p> }
          @if (cfg()!.kind === 'AMRAP' && started()) {
            <button type="button" class="plus" (click)="addRound()">+1 VOLTA · {{ rounds() }} {{ rounds() === 1 ? 'feita' : 'feitas' }}</button>
          }
          <div class="controls">
            <button type="button" class="ctl" aria-label="Terminar agora" (click)="stopEarly()" [disabled]="!started()">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            </button>
            <button type="button" class="play" [attr.aria-label]="running() ? 'Pausa' : started() ? 'Continuar' : 'Começar'" (click)="toggle()">
              @if (running()) {
                <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
              } @else {
                <svg viewBox="0 0 24 24" width="38" height="38" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" /></svg>
              }
            </button>
            <button type="button" class="ctl" aria-label="Saltar fase" (click)="skip()" [disabled]="!started()">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5l9 7-9 7V5zM19 5v14" /></svg>
            </button>
          </div>
          <p class="note">Apita e vibra em cada troca. No Android, avisa também com o ecrã bloqueado.</p>
        </div>
      }
    </ion-content>
  `,
  styles: `
    ion-content { --background: var(--ion-color-primary); --color: var(--ion-color-primary-contrast); transition: --background 300ms; }
    ion-content.phase-rest { --background: var(--gt-flame); --color: #17201c; }
    ion-content.phase-done { --background: var(--ion-color-success, #2dd36f); --color: #fff; }
    .center { display: grid; place-items: center; height: 60vh; }
    .page { max-width: 480px; margin: 0 auto; min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column;
      padding: 12px 16px calc(20px + var(--ion-safe-area-bottom, 0px)); text-align: center; }
    .top { display: flex; align-items: center; gap: 10px; }
    .x { width: 44px; height: 44px; border: 0; border-radius: 12px; background: rgba(255,255,255,.22); color: inherit; display: grid; place-items: center; }
    .cfg { flex: 1; text-align: left; font-weight: 900; font-size: .95rem; letter-spacing: .03em; }
    .phase { margin: 16px 0 0; font-size: 2.1rem; letter-spacing: .04em; }
    .ring { position: relative; width: 250px; height: 250px; margin: 10px auto 0; }
    .arc { transition: stroke-dasharray 250ms linear; }
    .clock { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .big { font-size: 4.6rem; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
    .round { font-weight: 800; font-size: 1.05rem; opacity: .9; }
    .now { margin-top: 14px; padding: 12px 16px; border-radius: 18px; background: rgba(255,255,255,.18); }
    .ex { font-size: 1.5rem; font-weight: 900; }
    .next { font-weight: 800; opacity: .9; }
    .last { margin: 10px 0 0; font-weight: 800; opacity: .9; }
    .plus { margin-top: 14px; min-height: 64px; border: 0; border-radius: 18px; background: #fff; color: var(--ion-color-primary);
      font: inherit; font-size: 1.2rem; font-weight: 900; box-shadow: 0 6px 0 rgba(0,0,0,.25); }
    .plus:active, .play:active, .ctl:active:not([disabled]), .go:active { transform: translateY(5px); box-shadow: none; }
    .controls { margin-top: auto; padding-top: 18px; display: flex; align-items: center; justify-content: center; gap: 24px; }
    .ctl { width: 60px; height: 60px; border-radius: 50%; border: 0; background: rgba(255,255,255,.25); color: inherit;
      box-shadow: 0 4px 0 rgba(0,0,0,.18); display: grid; place-items: center; }
    .ctl[disabled] { opacity: .4; }
    .play { width: 92px; height: 92px; border-radius: 50%; border: 0; background: #fff; color: #17201c; box-shadow: 0 7px 0 rgba(0,0,0,.25);
      display: grid; place-items: center; }
    .note { margin: 14px 0 0; font-size: .85rem; font-weight: 700; opacity: .9; }
    .result h1 { margin: 40px 0 0; font-size: 2.2rem; }
    .sub { margin: 4px 0 18px; font-weight: 800; opacity: .9; }
    .field { display: grid; grid-template-columns: 1fr 56px 72px 56px; align-items: center; gap: 8px; margin: 8px 0; text-align: left; font-weight: 800; }
    .field strong { text-align: center; font-size: 1.8rem; font-variant-numeric: tabular-nums; }
    .step { height: 52px; border-radius: 14px; border: 0; background: rgba(255,255,255,.25); color: inherit; font: inherit; font-size: 1.5rem; font-weight: 900;
      box-shadow: 0 4px 0 rgba(0,0,0,.18); }
    .go { margin-top: 24px; min-height: 60px; border: 0; border-radius: 18px; background: #fff; color: #17201c; font: inherit; font-size: 1.15rem;
      font-weight: 900; box-shadow: 0 6px 0 rgba(0,0,0,.25); }
    .link { min-height: 48px; border: 0; background: none; color: inherit; font: inherit; font-weight: 800; text-decoration: underline; }
    @media (prefers-reduced-motion: reduce) { ion-content, .arc { transition: none; } }
  `,
})
export class TimedPage implements ViewWillEnter, OnDestroy {
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly groups = inject(GROUP_REPOSITORY);
  private readonly notifier = inject(TimerNotifier);
  private readonly timer = inject(TimerService);
  private readonly haptics = inject(HapticsService);
  private readonly nav = inject(NavController);

  readonly key = input.required<string>();
  readonly cfg = signal<GroupConfig | null>(null);
  readonly members = signal<SessionExercise[]>([]);
  readonly last = signal<GroupResult | null>(null);
  private sessionId: string | null = null;

  /** Hora de início (ms) descontadas as pausas; null antes de começar. */
  private startMs: number | null = null;
  private pausedAt: number | null = null;
  readonly running = signal(false);
  readonly started = signal(false);
  readonly step = signal<'timer' | 'result'>('timer');
  readonly elapsed = signal(0);
  readonly rounds = signal(0);
  readonly extra = signal(0);
  private ticker: ReturnType<typeof setInterval> | null = null;
  private lastIndex = -1;

  readonly plan = computed<Phase[]>(() => (this.cfg() ? timedPlan(this.cfg()!, this.members().length) : []));
  readonly at = computed(() => phaseAt(this.plan(), this.elapsed()));
  readonly phase = computed(() => this.plan()[Math.max(0, this.at().index)] ?? null);
  readonly title = computed(() => (this.cfg() ? groupLabel(this.cfg()!) : ''));
  readonly phaseClass = computed(() => (this.step() === 'result' || this.at().done && this.started() ? 'done' : this.phase()?.kind === 'rest' ? 'rest' : 'work'));
  readonly phaseLabel = computed(() => {
    if (!this.started()) return 'PRONTO?';
    if (this.at().done) return 'FEITO!';
    if (this.phase()?.kind === 'rest') return 'DESCANSO';
    return this.cfg()?.kind === 'AMRAP' ? 'VAI!' : 'TRABALHO';
  });
  readonly clock = computed(() => {
    const s = this.started() ? this.at().remaining : (this.plan()[0]?.seconds ?? 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  readonly dash = computed(() => {
    const p = this.phase();
    const f = !this.started() || !p ? 1 : this.at().remaining / Math.max(1, p.seconds);
    return `${(RING * f).toFixed(1)} ${RING.toFixed(1)}`;
  });
  readonly roundLabel = computed(() => {
    const c = this.cfg();
    if (!c) return '';
    if (c.kind === 'AMRAP') return `${this.rounds()} ${this.rounds() === 1 ? 'volta' : 'voltas'}`;
    return `Ronda ${this.phase()?.round ?? 1} de ${c.rounds}`;
  });
  readonly exerciseNow = computed(() => {
    const p = this.phase();
    const m = this.members();
    if (!p || p.kind === 'rest') return 'Respira';
    return p.exercise < 0 ? m.map((x) => x.exerciseName).join(' · ') : (m[p.exercise]?.exerciseName ?? '');
  });
  readonly nextLabel = computed(() => {
    const c = this.cfg();
    const p = this.phase();
    if (!c || !p) return '';
    if (c.kind === 'AMRAP') return 'Toca em +1 VOLTA no fim de cada volta';
    if (c.kind === 'EMOM') return 'Faz as repetições e descansa o resto do minuto';
    if (p.kind === 'rest') return `A seguir: ${this.members()[p.exercise]?.exerciseName ?? ''}`;
    return c.restSeconds ? `Depois: descanso ${c.restSeconds} s` : '';
  });

  async ionViewWillEnter(): Promise<void> {
    const s = await this.sessions.getActive();
    if (!s) { this.nav.navigateRoot('/home'); return; }
    this.sessionId = s.id;
    const g = (await this.groups.forSession(s.id)).find((x) => x.groupKey === this.key());
    if (!g) { this.nav.navigateBack('/sessao'); return; }
    this.members.set(s.exercises.filter((e) => e.supersetGroup === this.key()).sort((a, b) => a.position - b.position));
    this.cfg.set(g);
    if (s.templateId) this.last.set(await this.groups.lastResult(s.templateId, this.key(), s.id));
  }

  ngOnDestroy(): void {
    if (this.ticker) clearInterval(this.ticker);
    void this.notifier.cancelMany();
  }

  max0 = (n: number) => Math.max(0, n);
  resultText = (r: GroupResult) =>
    `${r.rounds ?? 0} ${this.cfg()?.kind === 'AMRAP' ? 'voltas' : 'rondas'}` + (r.reps ? ` + ${r.reps} reps` : '');

  toggle(): void {
    this.timer.unlockAudio();
    const now = Date.now();
    if (!this.started()) {
      this.startMs = now;
      this.started.set(true);
      this.running.set(true);
      this.haptics.tap();
      this.tick();
      this.ticker = setInterval(() => this.tick(), 250);
      this.scheduleNotifications();
      return;
    }
    if (this.running()) {
      this.pausedAt = now;
      this.running.set(false);
      void this.notifier.cancelMany();
    } else {
      if (this.pausedAt !== null && this.startMs !== null) this.startMs += now - this.pausedAt;
      this.pausedAt = null;
      this.running.set(true);
      this.scheduleNotifications();
    }
  }

  skip(): void {
    const p = this.phase();
    if (!p || this.startMs === null) return;
    const jump = Math.max(0, p.start + p.seconds - this.elapsed());
    this.startMs -= jump * 1000;
    this.tick();
    if (this.running()) this.scheduleNotifications();
  }

  addRound(): void {
    this.rounds.update((n) => n + 1);
    this.haptics.tap();
  }

  stopEarly(): void {
    this.finish();
  }

  async save(): Promise<void> {
    if (!this.sessionId) return;
    const c = this.cfg()!;
    const seconds = Math.round(Math.min(this.elapsed(), planSeconds(this.plan())));
    await this.groups.saveResult(this.sessionId, this.key(), { rounds: this.rounds(), reps: c.kind === 'AMRAP' ? this.extra() : null, seconds });
    this.haptics.success();
    this.nav.navigateBack('/sessao');
  }

  back(): void {
    this.nav.navigateBack('/sessao');
  }

  private tick(): void {
    if (this.startMs === null) return;
    const now = this.pausedAt ?? Date.now();
    this.elapsed.set((now - this.startMs) / 1000);
    const at = this.at();
    if (at.index !== this.lastIndex) {
      if (this.lastIndex >= 0) { this.timer.beep(); this.haptics.tap(); }
      this.lastIndex = at.index;
    }
    if (at.done) this.finish();
  }

  private finish(): void {
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
    void this.notifier.cancelMany();
    this.running.set(false);
    if (this.cfg()?.kind !== 'AMRAP') this.rounds.set(roundsDone(this.plan(), this.elapsed()));
    this.timer.beep();
    this.haptics.success();
    this.step.set('result');
  }

  /** Uma notificação por troca de fase, a partir de agora (ecrã bloqueado no Android). */
  private scheduleNotifications(): void {
    if (this.startMs === null) return;
    const label = GROUP_LABEL[this.cfg()!.kind];
    const items = this.plan().slice(1).map((p) => ({
      at: new Date(this.startMs! + p.start * 1000),
      title: `${label}: ${p.kind === 'rest' ? 'descanso' : 'trabalho'}`,
      body: p.kind === 'rest' ? `${p.seconds} s` : (this.members()[p.exercise]?.exerciseName ?? `Ronda ${p.round}`),
    }));
    items.push({ at: new Date(this.startMs + planSeconds(this.plan()) * 1000), title: `${label}: feito!`, body: 'Guarda as rondas na app.' });
    void this.notifier.scheduleMany(items);
  }
}
