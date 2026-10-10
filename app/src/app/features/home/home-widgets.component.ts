import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular';
import { SettingsService } from '../../core/settings/settings.service';
import { CLOCK } from '../../core/util/clock';
import { addDays, toLocalDate, weekStartOf } from '../../core/util/week';
import { METRICS_REPOSITORY, SCHEDULED_REPOSITORY } from '../../data/repositories/providers';
import { SessionLauncher } from '../session/session-launcher';

export const WIDGETS = [
  { id: 'next-workout', label: 'Próximo treino' },
  { id: 'weekly-sets', label: 'Séries da semana por músculo' },
  { id: 'mobility-minutes', label: 'Mobilidade da semana' },
] as const;

/** Os widgets da Home, pela ordem e com os que escolheres (definição home.widgets). */
@Component({
  selector: 'app-home-widgets',
  imports: [RouterLink, IonButton],
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
        @case ('weekly-sets') {
          <section class="widget">
            <h3>Séries esta semana</h3>
            @if (data.value()?.sets?.length) {
              <ul class="bars">
                @for (m of data.value()!.sets; track m.muscleId) {
                  <li>
                    <span class="name">{{ m.muscle }}</span>
                    <span class="track"><span class="fill" [style.width.%]="(m.series / max()) * 100"></span></span>
                    <span class="n">{{ fmt(m.series) }}</span>
                  </li>
                }
              </ul>
              <p class="muted small">Só séries de trabalho de força. Músculos secundários contam {{ fmt(secondary()) }}.</p>
            } @else {
              <p class="muted">Ainda sem séries de força esta semana.</p>
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

  readonly secondary = this.settings.get('secondaryMuscleWeight');
  private readonly widgets = this.settings.get('homeWidgets');
  readonly enabled = computed(() => this.widgets().filter((id) => WIDGETS.some((w) => w.id === id)));

  readonly data = resource({
    params: () => ({ r: this.refresh(), w: this.enabled(), sw: this.secondary() }),
    loader: async ({ params }) => {
      const today = toLocalDate(this.clock.now());
      const week = weekStartOf(today);
      const has = (id: string) => params.w.includes(id);
      return {
        next: has('next-workout') ? await this.scheduled.next(today) : null,
        sets: has('weekly-sets') ? await this.metrics.weeklySetsByMuscle(week, params.sw) : [],
        mobility: has('mobility-minutes') ? await this.metrics.mobilityWeek(week) : null,
        streak: has('mobility-minutes') ? await this.metrics.mobilityStreak(today) : 0,
      };
    },
  });
  readonly max = computed(() => Math.max(1, ...(this.data.value()?.sets ?? []).map((s) => s.series)));

  fmt = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 1 });

  dayLabel(date: string): string {
    const today = toLocalDate(this.clock.now());
    if (date === today) return 'Hoje';
    if (date === addDays(today, 1)) return 'Amanhã';
    if (date < today) return 'Em atraso: ' + new Date(date + 'T12:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
    return new Date(date + 'T12:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
