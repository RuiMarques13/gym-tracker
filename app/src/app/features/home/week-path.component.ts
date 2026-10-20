import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { weeklyStreak } from '../../core/progression/streak';
import { weekPath, type PathStep } from '../../core/progression/week-path';
import { addDays, toLocalDate, weekStartOf } from '../../core/util/week';
import { CLOCK } from '../../services/clock';
import { SCHEDULED_REPOSITORY, SESSION_REPOSITORY } from '../../services/repositories';
import { SettingsService } from '../../services/settings/settings.service';
import { SessionLauncher } from '../session/session-launcher';

const DAY = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DAY_LONG = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
/** Desvio horizontal de cada passo (px): caminho em zigue-zague. */
const ZIGZAG = [0, 56, 0, -56];

/**
 * Topo da Home: sequência semanal, objetivo da semana e o caminho da semana (feitos, hoje, planeados), com os botões
 * para começar. Os dados vêm dos treinos terminados e dos Planeados (core/progression/week-path.ts e streak.ts).
 */
@Component({
  selector: 'app-week-path',
  imports: [RouterLink],
  template: `
    @if (view.value(); as v) {
      <div class="pills">
        <span class="pill flame" [attr.aria-label]="'Sequência: ' + v.streak.weeks + (v.streak.weeks === 1 ? ' semana seguida' : ' semanas seguidas')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--gt-flame)" stroke="var(--gt-flame-press)" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-4-1-6 1-9.5z" /></svg>
          {{ v.streak.weeks }} {{ v.streak.weeks === 1 ? 'semana' : 'semanas' }}
        </span>
        <span class="pill goal" [attr.aria-label]="'Esta semana: ' + v.streak.thisWeek + ' de ' + v.streak.goal + ' treinos'">
          <svg viewBox="0 0 36 36" width="20" height="20" aria-hidden="true">
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--gt-line)" stroke-width="6" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--ion-color-primary)" stroke-width="6" stroke-linecap="round"
              [attr.stroke-dasharray]="ring(v.streak.thisWeek / v.streak.goal)" transform="rotate(-90 18 18)" />
          </svg>
          {{ v.streak.thisWeek }}/{{ v.streak.goal }}
        </span>
      </div>

      <h1 class="title">{{ title() }}</h1>

      <ol class="path" aria-label="Caminho da semana">
        @for (s of v.steps; track s.date + s.kind; let i = $index) {
          <li class="step" [style.--dx.px]="dx(i)" [class.is-today]="s.kind === 'today'">
            @if (s.kind === 'today' && !active()) {
              <span class="bubble" aria-hidden="true">COMEÇAR</span>
              <button type="button" class="node today" (click)="start(s)" [attr.aria-label]="'Começar ' + (s.name ?? 'sessão livre')">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg>
              </button>
            } @else {
              <span class="node" [class]="'node ' + s.kind" aria-hidden="true">
                @switch (s.kind) {
                  @case ('done') { <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> }
                  @case ('today') { <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg> }
                  @case ('missed') { <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17" /></svg> }
                  @case ('skipped') { <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14" /></svg> }
                  @default { <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg> }
                }
              </span>
            }
            <span class="label">
              <strong>{{ s.name ?? (s.kind === 'today' ? 'Sessão livre' : 'Treino') }}</strong>
              <small>{{ day[s.weekday] }} · {{ stateText(s) }}</small>
            </span>
          </li>
        }
      </ol>
      @if (!v.anyPlanned) {
        <p class="hint">Planeia os treinos da semana para os veres aqui. <a routerLink="/planeados">Planear</a></p>
      }

      @if (!active()) {
        <div class="cta">
          @if (todayPlan(); as tp) {
            <button type="button" class="btn main" (click)="start(tp)">COMEÇAR {{ (tp.name ?? '').toUpperCase() }}</button>
            <button type="button" class="btn alt" (click)="launcher.start(null)">SESSÃO LIVRE</button>
          } @else {
            <button type="button" class="btn main" (click)="launcher.start(null)">SESSÃO LIVRE</button>
            <a class="btn alt" routerLink="/treinos">ESCOLHER UM TREINO</a>
          }
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; margin: 4px 0 18px; }
    .pills { display: flex; justify-content: flex-end; gap: 8px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 12px; border-radius: 999px; font-weight: 900; font-size: 1rem; }
    .flame { background: var(--gt-flame-tint); }
    .goal { background: rgba(var(--ion-color-primary-rgb), .14); }
    .title { margin: 6px 0 4px; font-size: 1.9rem; }
    .path { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; align-items: center; gap: 14px; }
    .step { display: flex; align-items: center; gap: 12px; transform: translateX(var(--dx, 0)); position: relative; }
    .step.is-today { flex-direction: column; gap: 6px; text-align: center; }
    .node { width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto; box-sizing: border-box; }
    .node.done { background: var(--ion-color-success, #2dd36f); box-shadow: 0 6px 0 color-mix(in srgb, var(--ion-color-success, #2dd36f) 60%, #000); }
    .node.planned { border: 3px dashed var(--gt-line-press); color: var(--ion-color-medium); }
    .node.missed, .node.skipped { background: var(--gt-line); color: var(--ion-color-medium); box-shadow: 0 5px 0 var(--gt-line-press); }
    .node.today { width: 92px; height: 92px; border: 6px solid rgba(var(--ion-color-primary-rgb), .18); background: var(--ion-color-primary);
      color: var(--ion-color-primary-contrast); box-shadow: 0 7px 0 color-mix(in srgb, var(--ion-color-primary) 62%, #000); padding: 0; font: inherit;
      transition: transform 80ms ease, box-shadow 80ms ease; animation: pulse 1.8s ease-out infinite; }
    span.node.today { width: 76px; height: 76px; animation: none; }
    button.node.today:active { transform: translateY(7px); box-shadow: none; }
    @keyframes pulse { 0% { outline: 0 solid rgba(var(--ion-color-primary-rgb), .45); } 70% { outline: 14px solid rgba(var(--ion-color-primary-rgb), 0); } 100% { outline: 0 solid transparent; } }
    .bubble { padding: 5px 12px; border-radius: 12px; background: var(--ion-text-color, #17201c); color: var(--ion-background-color, #fff);
      font-weight: 900; font-size: .85rem; letter-spacing: .04em; animation: bob 1.6s ease-in-out infinite; }
    @keyframes bob { 50% { transform: translateY(-4px); } }
    .label { display: grid; gap: 1px; min-width: 0; }
    .label strong { font-size: 1rem; font-weight: 900; }
    .label small { font-size: .85rem; font-weight: 700; color: var(--ion-color-medium); }
    .hint { margin: 14px 0 0; text-align: center; font-size: .9rem; color: var(--ion-color-medium); }
    .cta { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 20px; }
    .btn { min-height: 56px; display: grid; place-items: center; border-radius: 16px; font: inherit; font-size: 1.05rem; font-weight: 900;
      letter-spacing: .03em; text-decoration: none; transition: transform 80ms ease, box-shadow 80ms ease; }
    .btn.main { border: 0; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast);
      box-shadow: 0 5px 0 color-mix(in srgb, var(--ion-color-primary) 62%, #000); }
    .btn.alt { border: 2px solid var(--gt-line); background: transparent; color: var(--ion-color-primary); box-shadow: 0 4px 0 var(--gt-line); }
    .btn:active { transform: translateY(5px); box-shadow: none; }
    @media (prefers-reduced-motion: reduce) { .node.today, .bubble { animation: none; } .btn, .node.today { transition: none; } }
  `,
})
export class WeekPathComponent {
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly scheduled = inject(SCHEDULED_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);
  readonly launcher = inject(SessionLauncher);

  /** Muda para recarregar (a Home sobe-o em cada entrada). */
  readonly refresh = input(0);
  /** Há uma sessão em curso: sem botões de começar (a Home mostra «Continuar»). */
  readonly active = input(false);
  readonly day = DAY;

  readonly view = resource({
    params: () => ({ r: this.refresh(), goal: this.settings.get('streakSessionsPerWeek')() }),
    loader: async ({ params }) => {
      const today = toLocalDate(this.clock.now());
      const week = weekStartOf(today);
      const finished = await this.sessions.listFinished({ limit: 5000 });
      const days = finished.map((s) => ({ date: toLocalDate(new Date(s.startedAt)), name: s.templateName }));
      const planned = await this.scheduled.list(week, addDays(week, 6));
      const steps = weekPath(today, days.filter((d) => d.date >= week), planned.map((p) => ({ id: p.id, date: p.date, templateId: p.templateId, name: p.templateName, status: p.status })));
      return { today, steps, streak: weeklyStreak(days.map((d) => d.date), today, params.goal), anyPlanned: planned.length > 0 };
    },
  });

  readonly todayPlan = computed(() => this.view.value()?.steps.find((s) => s.kind === 'today' && s.planned) ?? null);
  readonly title = computed(() => {
    const v = this.view.value();
    if (!v) return '';
    const t = v.steps.find((s) => s.kind === 'today');
    if (t?.name) return `Hoje: ${t.name}`;
    const doneToday = v.steps.some((s) => s.kind === 'done' && s.date === v.today);
    return doneToday ? 'Feito por hoje' : DAY_LONG[(new Date(v.today + 'T12:00').getDay() + 6) % 7];
  });

  dx = (i: number) => ZIGZAG[i % ZIGZAG.length];
  ring = (f: number) => `${Math.max(0, Math.min(1, f)) * 88} 88`;
  stateText = (s: PathStep) =>
    ({ done: s.sessions > 1 ? `${s.sessions} treinos` : 'feito', today: 'hoje', planned: 'planeado', missed: 'ficou por fazer', skipped: 'saltado', rest: 'descanso' })[s.kind];

  start(s: PathStep): void {
    void this.launcher.start(s.planned?.templateId ?? null, s.planned?.id);
  }
}
