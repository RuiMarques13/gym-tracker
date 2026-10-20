import { Component, computed, inject, input, OnDestroy, signal } from '@angular/core';
import { IonContent, IonSpinner, NavController, ViewWillEnter } from '@ionic/angular';
import { sessionStats } from '../../core/metrics/session-stats';
import { MUSCLE_LABEL, specOfMuscleIds } from '../../core/metrics/muscles';
import { sessionRecords, type NewRecord, type RecordSet } from '../../core/progression/records';
import { weeklyStreak, type WeekStreak } from '../../core/progression/streak';
import { toLocalDate } from '../../core/util/week';
import type { MetricSet } from '../../core/metrics/volume';
import { workingSetCount, type Session } from '../../data/models/session';
import { CLOCK } from '../../services/clock';
import { BodyProfileService } from '../../services/health/body-profile.service';
import { VolumeService } from '../../services/metrics/volume.service';
import { EXERCISE_REPOSITORY, METRICS_REPOSITORY, SESSION_REPOSITORY } from '../../services/repositories';
import { SettingsService } from '../../services/settings/settings.service';
import { HapticsService } from '../../services/ui/haptics.service';
import { formatDay } from '../history/history-format';

const DAY_LETTER = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

interface RecordRow { name: string; text: string }
interface MuscleRow { label: string; sets: number; target: number; pct: number }

/** Fim do treino: festa, números do treino, recordes, sequência semanal e séries da semana dos músculos treinados. */
@Component({
  selector: 'app-session-finish',
  imports: [IonContent, IonSpinner],
  template: `
    <ion-content>
      @if (!session()) {
        <div class="center"><ion-spinner /></div>
      } @else {
        <div class="page">
          <div class="confetti" aria-hidden="true">
            @for (c of pieces; track $index) { <i [style.left.%]="c.x" [style.background]="c.color" [style.animation-delay.ms]="c.delay"></i> }
          </div>

          <section class="hero">
            <div class="badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
            <h1>Treino feito!</h1>
            <p class="sub">{{ session()!.templateName ?? 'Sessão livre' }} · {{ day() }}</p>
          </section>

          <section class="tiles rise r1" aria-label="Números do treino">
            <div class="tile t-time"><span class="h">TEMPO</span><span class="v">{{ count(minutes()) }} min</span></div>
            <div class="tile t-sets"><span class="h">SÉRIES</span><span class="v">{{ count(sets()) }}</span></div>
            <div class="tile t-vol"><span class="h">VOLUME</span><span class="v">{{ countKg(volume()) }}</span></div>
          </section>

          @for (r of records(); track r.name) {
            <section class="record rise r2">
              <span class="medal" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" /></svg>
              </span>
              <div><strong>Novo recorde!</strong><p>{{ r.name }} · {{ r.text }}</p></div>
            </section>
          }

          @if (streak(); as st) {
            <section class="streak rise r3" aria-label="Sequência semanal">
              <div class="streak-head">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="var(--gt-flame)" stroke="var(--gt-flame-press)" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-4-1-6 1-9.5z" /></svg>
                <strong>{{ st.weeks }} {{ st.weeks === 1 ? 'semana seguida' : 'semanas seguidas' }}</strong>
                <span class="goal">{{ st.thisWeek }} de {{ st.goal }} esta semana</span>
              </div>
              <div class="week">
                @for (d of st.days; track d.date; let i = $index) {
                  <div class="day" [attr.aria-label]="dayLabel(d, i)">
                    <span class="circle" [class.on]="d.trained" [class.today]="d.today" [class.future]="d.future"></span>
                    <span class="letter" aria-hidden="true">{{ letters[i] }}</span>
                  </div>
                }
              </div>
              @if (!st.thisWeekDone) { <p class="hint">{{ st.goal - st.thisWeek === 1 ? "Falta 1 treino" : "Faltam " + (st.goal - st.thisWeek) + " treinos" }} para esta semana contar.</p> }
            </section>
          }

          @if (muscles().length) {
            <section class="muscles rise r4" aria-label="Séries desta semana">
              <h2>Séries nos últimos 7 dias</h2>
              @for (m of muscles(); track m.label) {
                <div class="mrow">
                  <span class="mlabel">{{ m.label }}</span>
                  <span class="mbar"><span class="mfill" [class.full]="m.pct >= 100" [style.width.%]="m.pct"></span></span>
                  <span class="mnum">{{ num(m.sets) }}/{{ m.target }}</span>
                </div>
              }
            </section>
          }

          <div class="actions">
            <button type="button" class="go" (click)="done()">CONTINUAR</button>
            <button type="button" class="link" (click)="details()">Ver o treino</button>
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: `
    .center { display: grid; place-items: center; height: 60vh; }
    .page { position: relative; max-width: 520px; margin: 0 auto; padding: 32px 16px calc(24px + var(--ion-safe-area-bottom, 0px)); overflow: hidden; }
    .confetti i { position: absolute; top: -20px; width: 10px; height: 14px; border-radius: 3px; animation: fall 1.8s ease-in both; }
    @keyframes fall { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(320px) rotate(320deg); opacity: 0; } }
    .hero { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
    .badge { width: 112px; height: 112px; border-radius: 50%; display: grid; place-items: center; background: var(--ion-color-success, #2dd36f);
      box-shadow: 0 8px 0 color-mix(in srgb, var(--ion-color-success, #2dd36f) 60%, #000); animation: pop 420ms cubic-bezier(.2, .9, .3, 1.3) both; }
    @keyframes pop { 0% { transform: scale(.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    h1 { margin: 14px 0 0; font-size: 2rem; }
    .sub { margin: 0; color: var(--ion-color-medium); font-weight: 700; }
    .rise { animation: rise 360ms ease-out both; }
    .r1 { animation-delay: 200ms; } .r2 { animation-delay: 320ms; } .r3 { animation-delay: 440ms; } .r4 { animation-delay: 560ms; }
    @keyframes rise { 0% { transform: translateY(16px); opacity: 0; } 100% { transform: none; opacity: 1; } }
    .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 22px; }
    .tile { border: 2px solid var(--c); border-radius: 16px; overflow: hidden; text-align: center; display: grid; }
    .tile .h { background: var(--c); color: var(--fg, #fff); font-size: 0.75rem; font-weight: 900; padding: 4px 0; letter-spacing: .04em; }
    .tile .v { font-size: 1.3rem; font-weight: 900; padding: 10px 2px; font-variant-numeric: tabular-nums; }
    .t-time { --c: var(--ion-color-primary); --fg: var(--ion-color-primary-contrast); }
    .t-sets { --c: var(--gt-flame); --fg: #17201c; }
    .t-vol { --c: #2f6fd8; }
    .record { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--gt-flame-tint); }
    .record strong { font-size: 1.05rem; font-weight: 900; }
    .record p { margin: 2px 0 0; font-weight: 700; font-size: 0.92rem; }
    .medal { flex: 0 0 auto; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--gt-flame);
      color: #17201c; box-shadow: 0 4px 0 var(--gt-flame-press); }
    .streak { margin-top: 14px; padding: 12px 14px; border: 2px solid var(--gt-line); border-radius: 16px; }
    .streak-head { display: flex; align-items: center; gap: 8px; }
    .streak-head strong { flex: 1; font-size: 1.05rem; font-weight: 900; }
    .goal { font-size: 0.85rem; font-weight: 800; color: var(--ion-color-medium); }
    .week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
    .day { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .circle { width: 32px; height: 32px; border-radius: 50%; background: var(--gt-line); box-sizing: border-box; }
    .circle.on { background: var(--gt-flame); box-shadow: 0 3px 0 var(--gt-flame-press); }
    .circle.today:not(.on) { border: 3px solid var(--gt-flame); background: transparent; }
    .circle.future { background: transparent; border: 3px dashed var(--gt-line); }
    .letter { font-size: 0.8rem; font-weight: 800; color: var(--ion-color-medium); }
    .hint { margin: 8px 0 0; font-size: 0.85rem; color: var(--ion-color-medium); font-weight: 700; }
    .muscles { margin-top: 14px; display: grid; gap: 8px; }
    .muscles h2 { margin: 0; font-size: 1rem; }
    .mrow { display: flex; align-items: center; gap: 10px; }
    .mlabel { width: 108px; font-weight: 800; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mbar { flex: 1; height: 14px; border-radius: 999px; background: var(--gt-line); overflow: hidden; }
    .mfill { display: block; height: 100%; border-radius: 999px; background: var(--ion-color-primary); transition: width 700ms ease-out; }
    .mfill.full { background: var(--ion-color-success, #2dd36f); }
    .mnum { width: 48px; text-align: right; font-weight: 900; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
    .actions { display: grid; gap: 4px; margin-top: 24px; }
    .go { min-height: 60px; border: 0; border-radius: 18px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast);
      font: inherit; font-size: 1.15rem; font-weight: 900; letter-spacing: .03em;
      box-shadow: 0 6px 0 color-mix(in srgb, var(--ion-color-primary) 62%, #000); transition: transform 80ms ease, box-shadow 80ms ease; }
    .go:active { transform: translateY(6px); box-shadow: none; }
    .link { min-height: 48px; border: 0; background: none; color: var(--ion-color-primary); font: inherit; font-weight: 800; }
    @media (prefers-reduced-motion: reduce) {
      .confetti { display: none; }
      .badge, .rise { animation: none; }
      .mfill, .go { transition: none; }
    }
  `,
})
export class SessionFinishPage implements ViewWillEnter, OnDestroy {
  private readonly repo = inject(SESSION_REPOSITORY);
  private readonly metrics = inject(METRICS_REPOSITORY);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  private readonly volumeSvc = inject(VolumeService);
  private readonly settings = inject(SettingsService);
  private readonly body = inject(BodyProfileService);
  private readonly haptics = inject(HapticsService);
  private readonly clock = inject(CLOCK);
  private readonly nav = inject(NavController);

  readonly id = input.required<string>();
  readonly session = signal<Session | null>(null);
  readonly records = signal<RecordRow[]>([]);
  readonly streak = signal<WeekStreak | null>(null);
  readonly muscles = signal<MuscleRow[]>([]);
  /** 0 → 1 em ~0,7 s: os números sobem até ao valor. */
  private readonly tween = signal(1);
  private raf: number | null = null;
  readonly letters = DAY_LETTER;
  readonly pieces = Array.from({ length: 16 }, (_, i) => ({ x: (i * 61) % 100, delay: (i * 90) % 600, color: ['#2fcb86', '#ff8a00', '#4f8df5'][i % 3] }));

  private readonly stats = computed(() => {
    const s = this.session();
    return s ? sessionStats(s, Date.parse(s.endedAt ?? s.startedAt), this.body.profile()) : null;
  });
  readonly minutes = computed(() => Math.max(1, Math.round((this.stats()?.totalSeconds ?? 0) / 60)));
  readonly sets = computed(() => (this.session()?.exercises ?? []).reduce((n, e) => n + workingSetCount(e), 0));
  readonly volume = computed(() => this.stats()?.volumeKg ?? 0);
  readonly day = computed(() => { const s = this.session(); return s ? formatDay(s.startedAt) : ''; });

  count = (n: number) => Math.round(n * this.tween()).toLocaleString('pt-PT');
  countKg = (n: number) => (n > 0 ? `${Math.round(n * this.tween()).toLocaleString('pt-PT')} kg` : '—');
  num = (x: number) => x.toLocaleString('pt-PT', { maximumFractionDigits: 1 });
  dayLabel = (d: WeekStreak['days'][number], i: number) =>
    `${['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][i]}: ${d.trained ? 'treino' : d.future ? 'ainda não' : 'sem treino'}`;

  async ionViewWillEnter(): Promise<void> {
    const s = await this.repo.get(this.id());
    if (!s) { this.nav.navigateRoot('/home'); return; }
    this.session.set(s);
    this.animate();
    this.haptics.success();
    void this.loadRecords(s);
    void this.loadStreak();
    void this.loadMuscles(s);
  }

  ngOnDestroy(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
  }

  done(): void {
    this.nav.navigateRoot('/home');
  }

  details(): void {
    this.nav.navigateRoot(['/historico', this.id()]);
  }

  private animate(): void {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      this.tween.set(1 - (1 - k) ** 3);
      this.raf = k < 1 ? requestAnimationFrame(step) : null;
    };
    this.tween.set(0);
    this.raf = requestAnimationFrame(step);
  }

  private async loadRecords(s: Session): Promise<void> {
    const toRec = (x: MetricSet): RecordSet => ({ exerciseId: x.exerciseId, weightKg: x.weightKg, reps: x.reps, rir: x.rir, type: x.type });
    const start = new Date(s.startedAt);
    const before = await this.metrics.metricData(new Date(0), start);
    const during = await this.metrics.metricData(start, new Date(Date.parse(s.endedAt ?? s.startedAt) + 1000));
    const found = sessionRecords(before.sets.map(toRec), during.sets.filter((x) => x.sessionId === s.id).map(toRec));
    const name = new Map(s.exercises.map((e) => [e.exerciseId, e.exerciseName]));
    this.records.set(found.map((r: NewRecord) => ({
      name: name.get(r.exerciseId) ?? '',
      text: `${this.num(r.weightKg)} kg × ${r.reps}` + (r.kind === 'weight' ? ` (+${this.num(r.value - r.previous)} kg)` : ` · 1RM est. ${this.num(r.value)} kg`),
    })));
  }

  private async loadStreak(): Promise<void> {
    const list = await this.repo.listFinished({ limit: 5000 });
    const days = list.map((x) => toLocalDate(new Date(x.startedAt)));
    this.streak.set(weeklyStreak(days, toLocalDate(this.clock.now()), this.settings.get('streakSessionsPerWeek')()));
  }

  private async loadMuscles(s: Session): Promise<void> {
    const trained = new Set<string>();
    for (const e of s.exercises) {
      if (e.kind !== 'STRENGTH' || !workingSetCount(e)) continue;
      const ex = await this.exercises.get(e.exerciseId);
      for (const m of specOfMuscleIds(ex?.primaryMuscleIds ?? [])) trained.add(m);
    }
    if (!trained.size) return;
    const view = await this.volumeSvc.load();
    this.muscles.set(view.rows
      .filter((r) => trained.has(r.muscle))
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 4)
      .map((r) => ({ label: MUSCLE_LABEL[r.muscle] ?? r.label, sets: r.sets, target: r.range.target, pct: Math.min(100, (r.sets / Math.max(1, r.range.target)) * 100) })));
  }
}
