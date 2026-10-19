import { rulesWithSecondaryWeight } from '../../core/metrics/volume-rules';
import { inject, Injectable } from '@angular/core';
import { METRICS_REPOSITORY } from '../repositories';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../clock';
import { MUSCLE_LABEL, SPEC_MUSCLES } from '../../core/metrics/muscles';
import { MetricProfile, Recommendation, recommend, weekProgress, WeekProgress } from '../../core/metrics/volume';
import { fromLocalDate, toLocalDate, weekStartOf } from '../../core/util/week';

const DAY = 86_400_000;
const STATUS_TEXT = { below: 'Abaixo', ok: 'Na faixa', above: 'Acima' } as const;

export interface VolumeRow extends Recommendation {
  label: string;
  /** Posições em % da barra. */
  fill: number;
  minPos: number;
  targetPos: number;
  maxPos: number;
  statusText: string;
}

export interface VolumeView {
  rows: VolumeRow[];
  /** As 3 mensagens mais relevantes: abaixo da faixa primeiro, depois acima. */
  tips: Recommendation[];
  /** Exercícios de força usados sem músculo principal (não contam). */
  missing: number;
  inRange: number;
  /** Soma das séries feitas (limitadas ao alvo de cada músculo) sobre a soma dos alvos. */
  progress: number;
  /** Alvo da semana (segunda a domingo) e progresso real dia a dia. */
  week: WeekProgress;
}

/** Calcula o volume semanal por músculo com o perfil (objetivo, nível) e o histórico dos últimos meses. */
@Injectable({ providedIn: 'root' })
export class VolumeService {
  private readonly repo = inject(METRICS_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);

  async load(): Promise<VolumeView> {
    const now = this.clock.now();
    const goalChanged = this.settings.get('profileGoalChangedAt')();
    const changed = goalChanged ? new Date(goalChanged) : now;
    const birth = this.settings.get('profileBirthDate')();
    const from = new Date(Math.min(changed.getTime() - 28 * DAY, now.getTime() - 35 * DAY));
    const md = await this.repo.metricData(from, new Date(now.getTime() + 1000));
    // exercícios principais: os 5 com mais séries de trabalho no período
    const count = new Map<string, number>();
    for (const s of md.sets) if (s.type === 'working') count.set(s.exerciseId, (count.get(s.exerciseId) ?? 0) + 1);
    const main = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    const profile: MetricProfile = {
      goal: this.settings.get('profileGoal')(), level: this.settings.get('profileLevel')(), goalChangedAt: changed,
      birthYear: birth ? Number(birth.slice(0, 4)) : null,
    };
    // O peso dos secundários é o das Definições (0,5 por defeito), em todas as contas de volume.
    const rules = rulesWithSecondaryWeight(this.settings.get('secondaryMuscleWeight')());
    const recs = recommend(profile, md.sets, md.exercises, [...SPEC_MUSCLES], main, now, rules);
    const rows = recs.map<VolumeRow>((r) => {
      const top = Math.max(r.range.max * 1.25, r.sets, 1);
      const pos = (n: number) => Math.min(100, (n / top) * 100);
      return {
        ...r, label: MUSCLE_LABEL[r.muscle] ?? r.muscle, fill: pos(r.sets), minPos: pos(r.range.min),
        targetPos: pos(r.range.target), maxPos: pos(r.range.max), statusText: STATUS_TEXT[r.status],
      };
    });
    const below = recs.filter((r) => r.status === 'below').sort((a, b) => b.range.min - b.sets - (a.range.min - a.sets) || b.sets - a.sets);
    const above = recs.filter((r) => r.status === 'above');
    const targetSum = recs.reduce((n, r) => n + r.range.target, 0);
    const doneSum = recs.reduce((n, r) => n + Math.min(r.sets, r.range.target), 0);
    const week = weekProgress(
      md.sets, md.exercises, new Map(recs.map((r) => [r.muscle, r.range.target])),
      fromLocalDate(weekStartOf(toLocalDate(now))), now, rules,
    );
    return {
      week, rows, tips: [...below, ...above].slice(0, 3), missing: md.withoutPrimary.length,
      inRange: recs.filter((r) => r.status === 'ok').length, progress: targetSum ? doneSum / targetSum : 0,
    };
  }
}
