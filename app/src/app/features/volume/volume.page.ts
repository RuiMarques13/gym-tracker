import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonNote, IonTitle, IonToolbar, ViewWillEnter } from '@ionic/angular';
import { MUSCLE_LABEL, SPEC_MUSCLES } from '../../core/metrics/muscles';
import { MetricProfile, Recommendation, recommend } from '../../core/metrics/volume';
import { SettingsService } from '../../core/settings/settings.service';
import { CLOCK } from '../../core/util/clock';
import { METRICS_REPOSITORY } from '../../data/repositories/providers';
import { NavButtonComponent } from '../../shared/nav-button.component';

const DAY = 86_400_000;
const GOAL_LABEL = { hypertrophy: 'Ganhar massa', maintenance: 'Manutenção', cut: 'Definição' } as const;
const LEVEL_LABEL = { beginner: 'Iniciante', intermediate: 'Intermédio', advanced: 'Avançado' } as const;
const STATUS_TEXT = { below: 'Abaixo', ok: 'Na faixa', above: 'Acima' } as const;

interface Row extends Recommendation {
  label: string;
  fill: number;
  minPos: number;
  targetPos: number;
  maxPos: number;
  statusText: string;
}

/** Volume semanal por músculo (últimos 7 dias): séries efetivas fracionais vs faixa recomendada. */
@Component({
  selector: 'app-volume',
  imports: [RouterLink, NavButtonComponent, IonHeader, IonToolbar, IonTitle, IonContent, IonNote],
  template: `
    <ion-header>
      <ion-toolbar><app-nav-button slot="start" /><ion-title>Volume semanal</ion-title></ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="page">
        <p class="sub">
          Últimos 7 dias · {{ goalLabel() }} · {{ levelLabel() }}.
          <a routerLink="/perfil">Alterar no perfil</a>
        </p>

        @if (tips().length) {
          <section class="card" aria-label="Recomendações">
            <h2>Recomendações</h2>
            <ul>
              @for (t of tips(); track t.muscle) { <li>{{ t.message }}</li> }
            </ul>
          </section>
        }

        @if (missing() > 0) {
          <p class="warn">{{ missing() }} exercício(s) sem músculo principal não contam para o volume. Edita-os em Exercícios.</p>
        }

        @if (data.isLoading()) {
          <p class="sub">A calcular…</p>
        } @else {
          <section class="card" aria-label="Séries por músculo">
            @for (r of rows(); track r.muscle) {
              <div class="row">
                <div class="head">
                  <strong>{{ r.label }}</strong>
                  <span class="num">{{ r.sets }} séries · {{ r.frequency }} {{ r.frequency === 1 ? 'sessão' : 'sessões' }}</span>
                </div>
                <div class="bar" role="img" [attr.aria-label]="r.label + ': ' + r.sets + ' séries, ' + r.statusText + ' (faixa ' + r.range.min + ' a ' + r.range.max + ')'">
                  <div class="zone" [style.left.%]="r.minPos" [style.width.%]="r.maxPos - r.minPos"></div>
                  <div class="fill" [class.below]="r.status === 'below'" [class.above]="r.status === 'above'" [style.width.%]="r.fill"></div>
                  <div class="tick" [style.left.%]="r.targetPos"></div>
                </div>
                <div class="foot">
                  <span class="chipst" [class.below]="r.status === 'below'" [class.above]="r.status === 'above'">{{ r.statusText }}</span>
                  <ion-note>faixa {{ r.range.min }}–{{ r.range.max }} · alvo {{ r.range.target }}</ion-note>
                </div>
              </div>
            }
          </section>
        }
        <p class="legal">Orientação geral de treino, não aconselhamento médico. Séries efetivas: de trabalho, 5–30 repetições, RIR ≤ 3 (ou sem RIR). Músculos secundários contam 0,5.</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 720px; margin: 0 auto; }
    .sub { color: var(--ion-color-medium); margin: 0 0 12px; }
    .card { background: var(--ion-card-background, var(--ion-item-background, #fff)); border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; }
    .card h2 { font-size: 1rem; margin: 0 0 8px; }
    .card ul { margin: 0; padding-left: 18px; }
    .card li { margin: 4px 0; }
    .warn { color: var(--ion-color-warning-shade, #92400e); font-size: 0.9rem; }
    .row { padding: 10px 0; border-bottom: 1px solid var(--ion-border-color, rgba(128,128,128,0.2)); }
    .row:last-child { border-bottom: 0; }
    .head, .foot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .num { font-variant-numeric: tabular-nums; color: var(--ion-color-medium); font-size: 0.88rem; }
    .bar { position: relative; height: 10px; border-radius: 5px; background: rgba(128,128,128,0.18); margin: 8px 0 6px; overflow: hidden; }
    .zone { position: absolute; top: 0; bottom: 0; background: rgba(15,118,110,0.22); }
    .fill { position: absolute; left: 0; top: 2px; bottom: 2px; border-radius: 3px; background: #0f766e; min-width: 0; }
    .fill.below { background: #b45309; }
    .fill.above { background: #b91c1c; }
    .tick { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--ion-text-color, #000); opacity: 0.55; }
    .chipst { font-size: 0.78rem; font-weight: 600; color: #0f766e; }
    .chipst.below { color: #b45309; }
    .chipst.above { color: #b91c1c; }
    .legal { color: var(--ion-color-medium); font-size: 0.8rem; margin: 8px 0 24px; }
    @media (prefers-color-scheme: dark) {
      .fill { background: #2cb5a8; } .fill.below { background: #f59e0b; } .fill.above { background: #f87171; }
      .chipst { color: #2cb5a8; } .chipst.below { color: #f59e0b; } .chipst.above { color: #f87171; }
      .zone { background: rgba(44,181,168,0.25); }
    }
  `,
})
export class VolumePage implements ViewWillEnter {
  private readonly repo = inject(METRICS_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);

  private readonly goal = this.settings.get('profileGoal');
  private readonly level = this.settings.get('profileLevel');
  private readonly goalChangedAt = this.settings.get('profileGoalChangedAt');
  private readonly birth = this.settings.get('profileBirthDate');

  readonly goalLabel = computed(() => GOAL_LABEL[this.goal()]);
  readonly levelLabel = computed(() => LEVEL_LABEL[this.level()]);

  readonly data = resource({
    params: () => ({ goal: this.goal(), level: this.level(), changed: this.goalChangedAt(), birth: this.birth() }),
    loader: async ({ params }) => {
      const now = this.clock.now();
      const changed = params.changed ? new Date(params.changed) : now;
      const from = new Date(Math.min(changed.getTime() - 28 * DAY, now.getTime() - 35 * DAY));
      const md = await this.repo.metricData(from, new Date(now.getTime() + 1000));
      // exercícios principais: os 5 com mais séries de trabalho nas últimas 8 semanas
      const count = new Map<string, number>();
      for (const s of md.sets) if (s.type === 'working') count.set(s.exerciseId, (count.get(s.exerciseId) ?? 0) + 1);
      const main = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
      const profile: MetricProfile = {
        goal: params.goal, level: params.level, goalChangedAt: changed,
        birthYear: params.birth ? Number(params.birth.slice(0, 4)) : null,
      };
      const recs = recommend(profile, md.sets, md.exercises, [...SPEC_MUSCLES], main, now);
      return { recs, missing: md.withoutPrimary.length };
    },
  });

  readonly missing = computed(() => this.data.value()?.missing ?? 0);

  readonly rows = computed<Row[]>(() =>
    (this.data.value()?.recs ?? []).map((r) => {
      const top = Math.max(r.range.max * 1.25, r.sets, 1);
      const pos = (n: number) => Math.min(100, (n / top) * 100);
      return {
        ...r, label: MUSCLE_LABEL[r.muscle] ?? r.muscle, fill: pos(r.sets), minPos: pos(r.range.min), targetPos: pos(r.range.target),
        maxPos: pos(r.range.max), statusText: STATUS_TEXT[r.status],
      };
    }),
  );

  /** As 3 mensagens mais relevantes: primeiro músculos abaixo da faixa (com algum treino ou os que mais faltam), depois acima. */
  readonly tips = computed(() => {
    const recs = this.data.value()?.recs ?? [];
    const below = recs.filter((r) => r.status === 'below').sort((a, b) => b.range.min - b.sets - (a.range.min - a.sets) || b.sets - a.sets);
    const above = recs.filter((r) => r.status === 'above');
    return [...below, ...above].slice(0, 3);
  });

  ionViewWillEnter(): void {
    this.data.reload();
  }
}
