import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular';
import { Category, CATEGORIES, CATEGORY_LABEL } from '../../data/models/enums';
import type { CategoryTotals } from '../../data/repositories/metrics.repository';
import { VolumeService } from '../../core/metrics/volume.service';
import { MuscleBarsComponent } from '../../shared/muscle-bars.component';
import { RecoveryCardComponent } from '../../shared/recovery-card.component';
import { SettingsService } from '../../core/settings/settings.service';
import { CLOCK } from '../../core/util/clock';
import { addDays, toLocalDate, weekStartOf } from '../../core/util/week';
import { EXERCISE_REPOSITORY, METRICS_REPOSITORY, SCHEDULED_REPOSITORY } from '../../data/repositories/providers';
import { SessionLauncher } from '../session/session-launcher';

export { DEFAULT_WIDGETS, normalizeWidgets, WIDGETS } from './widget-list';
import { normalizeWidgets } from './widget-list';

/** Os widgets da Home, pela ordem e com os que escolheres (definição home.widgets). */
@Component({
  selector: 'app-home-widgets',
  imports: [RouterLink, IonButton, MuscleBarsComponent, RecoveryCardComponent],
  template: `
    @for (id of enabled(); track id) {
      @switch (id) {
        @case ('next-workout') {
          <section class="widget">
            <h3>Próximo treino</h3>
            @if (data.value()?.next; as n) {
              <div class="next">
                <div>
                  <strong>{{ n.templateName }}</strong>
                  <span>{{ dayLabel(n.date) }}</span>
                </div>
                <ion-button size="small" (click)="launcher.start(n.templateId, n.id)">Iniciar</ion-button>
              </div>
            } @else {
              <p class="muted">Nada planeado. <a routerLink="/planeados">Planear um treino</a></p>
            }
          </section>
        }
        @case ('week-summary') {
          <section class="widget">
            <h3>Esta semana</h3>
            @if (data.value()?.week; as w) {
              <div class="quad">
                <div><span class="value">{{ activeTime(w.activeSeconds) }}</span><span class="label">tempo ativo</span></div>
                <div><span class="value">{{ w.sessions }}</span><span class="label">{{ w.sessions === 1 ? 'sessão' : 'sessões' }}</span></div>
                <div><span class="value">{{ w.exercises }}</span><span class="label">{{ w.exercises === 1 ? 'exercício' : 'exercícios' }}</span></div>
                <div><span class="value">{{ w.sets }}</span><span class="label">{{ w.sets === 1 ? 'série' : 'séries' }}</span></div>
              </div>
            }
          </section>
        }
        @case ('volume-week') {
          <section class="widget">
            <h3>Volume semanal <a class="more" routerLink="/volume">detalhe</a></h3>
            @if (volume.value(); as v) {
              <div class="headline">
                <span class="value">{{ v.inRange }}<small> de {{ v.rows.length }}</small></span>
                <span class="label">músculos na faixa recomendada</span>
              </div>
              <div class="prog" role="progressbar" aria-label="Progresso para o alvo semanal" [attr.aria-valuenow]="pct(v.progress)" aria-valuemin="0" aria-valuemax="100">
                <div class="prog-fill" [style.width.%]="pct(v.progress)"></div>
              </div>
              <p class="muted small">{{ pct(v.progress) }}% do alvo semanal (soma dos alvos por músculo, últimos 7 dias).</p>
              <app-muscle-bars [rows]="shownRows()" />
              @if (restCount() > 0) {
                <ion-button fill="clear" size="small" (click)="showAll.set(!showAll())">
                  {{ showAll() ? 'Mostrar só os treinados' : 'Ver os restantes (' + restCount() + ')' }}
                </ion-button>
              }
              <p class="muted small">Orientação geral de treino, não aconselhamento médico.</p>
            } @else {
              <p class="muted">A calcular…</p>
            }
          </section>
        }
        @case ('recovery') {
          <section class="widget">
            <h3>Descanso recomendado</h3>
            <app-recovery-card [refresh]="refresh()" />
          </section>
        }
        @case ('exercise-counts') {
          <section class="widget">
            <h3>Os teus exercícios</h3>
            <div class="grid4">
              @for (c of categories; track c) {
                <a class="stat" routerLink="/exercicios" [queryParams]="{ category: c }">
                  <span class="value">{{ data.value()?.counts?.[c] ?? '–' }}</span><span class="label">{{ categoryLabel[c] }}</span>
                </a>
              }
            </div>
          </section>
        }
        @case ('category-week') {
          <section class="widget">
            <h3>Esta semana por categoria</h3>
            @if (data.value()?.byCategory; as rows) {
              @if (rows.length) {
                <ul class="cats">
                  @for (r of rows; track r.category) {
                    <li>
                      <strong>{{ categoryLabel[r.category] }}</strong>
                      <span>{{ categorySummary(r) }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="muted">Ainda sem séries concluídas esta semana.</p>
              }
            } @else {
              <p class="muted">A calcular…</p>
            }
          </section>
        }
        @case ('mobility-minutes') {
          <section class="widget">
            <h3>Mobilidade esta semana</h3>
            @if (data.value()?.mobility; as m) {
              <div class="trio">
                <div><span class="value">{{ fmt(m.minutes) }}</span><span class="label">minutos</span></div>
                <div><span class="value">{{ m.sessions }}</span><span class="label">{{ m.sessions === 1 ? 'sessão' : 'sessões' }}</span></div>
                <div><span class="value">{{ data.value()!.streak }}</span><span class="label">{{ data.value()!.streak === 1 ? 'dia seguido' : 'dias seguidos' }}</span></div>
              </div>
            }
          </section>
        }
      }
    }
  `,
  styles: `
    .widget { margin: 0 0 16px; padding: 14px 16px; border-radius: 14px; background: var(--ion-background-color-step-50, rgba(127,127,127,0.08)); }
    h3 { margin: 0 0 10px; font-size: 0.8rem; font-weight: 700; color: var(--ion-color-medium); }
    .muted { color: var(--ion-color-medium); margin: 0; }
    .small { font-size: 0.78rem; margin-top: 10px; }
    .next { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .next strong { display: block; font-size: 1.1rem; }
    .next span { color: var(--ion-color-medium); font-size: 0.9rem; }
    .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .bars li { display: grid; grid-template-columns: 96px 1fr 34px; gap: 10px; align-items: center; font-size: 0.9rem; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { height: 10px; border-radius: 5px; background: var(--ion-color-step-150, rgba(127,127,127,0.2)); overflow: hidden; }
    .fill { display: block; height: 100%; border-radius: 5px; background: var(--ion-color-primary); }
    .n { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .more { float: right; font-weight: 400; font-size: 0.8rem; }
    .quad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .quad div { display: flex; flex-direction: column; }
    .quad .value { font-size: 1.35rem; }
    .headline { display: flex; flex-direction: column; margin-bottom: 8px; }
    .headline small { font-size: 1rem; font-weight: 500; color: var(--ion-color-medium); }
    .prog { height: 12px; border-radius: 6px; background: var(--ion-color-step-150, rgba(127,127,127,0.2)); overflow: hidden; }
    .prog-fill { height: 100%; border-radius: 6px; background: var(--ion-color-primary); }
    a.stat { text-decoration: none; color: inherit; display: flex; flex-direction: column; }
    .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 8px; }
    .grid4 .value { font-size: 1.35rem; }
    .grid4 .label { font-size: 0.72rem; }
    .cats { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .cats li { display: flex; justify-content: space-between; gap: 12px; font-size: 0.9rem; }
    .cats span { color: var(--ion-color-medium); font-variant-numeric: tabular-nums; text-align: right; }
    .trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .trio div { display: flex; flex-direction: column; }
    .value { font-size: 1.7rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ion-color-primary); }
    .label { font-size: 0.82rem; color: var(--ion-color-medium); }
  `,
})
export class HomeWidgetsComponent {
  /** Muda de valor sempre que o ecrã volta a ser mostrado, para recarregar os números. */
  readonly refresh = input.required<number>();
  readonly launcher = inject(SessionLauncher);
  private readonly metrics = inject(METRICS_REPOSITORY);
  private readonly scheduled = inject(SCHEDULED_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);

  private readonly widgets = this.settings.get('homeWidgets');
  private readonly volumeService = inject(VolumeService);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  readonly enabled = computed(() => normalizeWidgets(this.widgets()));
  readonly showAll = signal(false);

  readonly data = resource({
    params: () => ({ r: this.refresh(), w: this.enabled() }),
    loader: async ({ params }) => {
      const today = toLocalDate(this.clock.now());
      const week = weekStartOf(today);
      const has = (id: string) => params.w.includes(id);
      let counts: Record<Category, number> | null = null;
      if (has('exercise-counts')) {
        const all = await this.exercises.list();
        counts = Object.fromEntries(CATEGORIES.map((c) => [c, all.filter((e) => e.category === c).length])) as Record<Category, number>;
      }
      return {
        next: has('next-workout') ? await this.scheduled.next(today) : null,
        week: has('week-summary') ? await this.metrics.weekSummary(week) : null,
        mobility: has('mobility-minutes') ? await this.metrics.mobilityWeek(week) : null,
        streak: has('mobility-minutes') ? await this.metrics.mobilityStreak(today) : 0,
        counts,
        byCategory: has('category-week') ? (await this.metrics.categoryWeek(week)).filter((r) => r.sets > 0 || r.minutes > 0) : null,
      };
    },
  });

  readonly volume = resource({
    params: () => ({ r: this.refresh(), on: this.enabled().includes('volume-week') }),
    loader: async ({ params }) => (params.on ? await this.volumeService.load() : undefined),
  });
  readonly shownRows = computed(() => {
    const rows = this.volume.value()?.rows ?? [];
    return this.showAll() ? rows : rows.filter((r) => r.sets > 0);
  });
  readonly restCount = computed(() => (this.volume.value()?.rows ?? []).filter((r) => r.sets === 0).length);

  readonly categories = CATEGORIES;
  readonly categoryLabel = CATEGORY_LABEL;

  /** «12 séries · 4 200 kg», «35 min · 5,2 km», «20 min»: só o que faz sentido para o que foi feito. */
  categorySummary(r: CategoryTotals): string {
    const parts: string[] = [];
    if (r.sets > 0) parts.push(`${r.sets} ${r.sets === 1 ? 'série' : 'séries'}`);
    if (r.volumeKg > 0) parts.push(`${this.fmt(r.volumeKg)} kg`);
    if (r.minutes > 0) parts.push(`${this.fmt(r.minutes)} min`);
    if (r.distanceKm > 0) parts.push(`${this.fmt(r.distanceKm)} km`);
    return parts.join(' · ');
  }

  pct = (p: number) => Math.round(p * 100);
  activeTime(seconds: number): string {
    const m = Math.round(seconds / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  }

  fmt = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 1 });

  dayLabel(date: string): string {
    const today = toLocalDate(this.clock.now());
    if (date === today) return 'Hoje';
    if (date === addDays(today, 1)) return 'Amanhã';
    if (date < today) return 'Em atraso: ' + new Date(date + 'T12:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
    return new Date(date + 'T12:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
