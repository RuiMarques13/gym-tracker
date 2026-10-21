import { inject, Injectable } from '@angular/core';
import { specOfMuscleIds } from '../../core/metrics/muscles';
import { weeklyStreak, type WeekStreak } from '../../core/progression/streak';
import { pickTodayWorkout, weekStrip, type DayPlanned, type WeekDay } from '../../core/progression/today';
import { addDays, toLocalDate, weekStartOf } from '../../core/util/week';
import { CLOCK } from '../clock';
import { RecoveryService } from '../metrics/recovery.service';
import { VolumeService } from '../metrics/volume.service';
import { CycleService } from '../progression/cycle.service';
import { EXERCISE_REPOSITORY, SCHEDULED_REPOSITORY, SESSION_REPOSITORY, WORKOUT_REPOSITORY } from '../repositories';
import { SettingsService } from '../settings/settings.service';

export interface TodayMuscle {
  muscle: string;
  /** Horas até estar pronto (0 = pronto). */
  hoursLeft: number;
}

export interface TodayWorkoutView {
  templateId: string;
  scheduledId: string | null;
  name: string;
  exercises: number;
  sets: number;
  muscles: TodayMuscle[];
  /** Sugestão pela recuperação (sem plano para hoje): dias desde a última vez; null = nunca feito. */
  suggestedDaysAgo?: number | null;
}

export interface HomeTodayView {
  today: string;
  /** Treino planeado para hoje (ou sugerido, se `suggested`). */
  workout: TodayWorkoutView | null;
  suggested: boolean;
  hasWorkouts: boolean;
  doneToday: boolean;
  cycleLine: string | null;
  cycleId: string | null;
  week: WeekDay[];
  anyPlanned: boolean;
  streak: WeekStreak;
  volume: { inRange: number; total: number; progress: number } | null;
  recovery: { recovering: number; next: { muscle: string; readyAt: Date } | null };
}

const DAY = 86_400_000;

/** Tudo o que a Home precisa: hoje, a semana, volume e recuperação (os cálculos vêm de core/). */
@Injectable({ providedIn: 'root' })
export class HomeTodayService {
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly scheduled = inject(SCHEDULED_REPOSITORY);
  private readonly workouts = inject(WORKOUT_REPOSITORY);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  private readonly recoverySvc = inject(RecoveryService);
  private readonly volumeSvc = inject(VolumeService);
  private readonly cycles = inject(CycleService);
  private readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);

  async load(): Promise<HomeTodayView> {
    const now = this.clock.now();
    const today = toLocalDate(now);
    const week = weekStartOf(today);
    const [finished, planned, recovery, volume, cycle, summaries] = await Promise.all([
      this.sessions.listFinished({ limit: 5000 }),
      this.scheduled.list(week, addDays(week, 6)),
      this.recoverySvc.load().catch(() => null),
      this.volumeSvc.load().catch(() => null),
      this.cycles.active().catch(() => null),
      this.workouts.list(),
    ]);
    const days = finished.map((s) => ({ date: toLocalDate(new Date(s.startedAt)), name: s.templateName }));
    const strip = weekStrip(today, days.filter((d) => d.date >= week),
      planned.map<DayPlanned>((p) => ({ id: p.id, date: p.date, templateId: p.templateId, name: p.templateName, status: p.status })));
    const todayDay = strip.find((d) => d.today)!;

    const advice = recovery?.advice ?? [];
    const hoursLeft = new Map(advice.map((a) => [a.muscle, a.hoursLeft]));
    const recovering = new Set(advice.filter((a) => a.status === 'recovering').map((a) => a.muscle));
    const musclesOf = async (templateId: string) => {
      const w = await this.workouts.get(templateId);
      if (!w) return null;
      const ids = new Set<string>();
      for (const it of w.items) {
        const ex = await this.exercises.get(it.exerciseId);
        for (const m of specOfMuscleIds(ex?.primaryMuscleIds ?? [])) ids.add(m);
      }
      return { w, muscles: [...ids] };
    };
    const view = (w: { id: string; name: string; items: { targetSets: number | null }[] }, muscles: string[], scheduledId: string | null): TodayWorkoutView => ({
      templateId: w.id, scheduledId, name: w.name, exercises: w.items.length,
      sets: w.items.reduce((n, i) => n + (i.targetSets ?? 0), 0),
      muscles: muscles.map((m) => ({ muscle: m, hoursLeft: hoursLeft.get(m) ?? 0 })).sort((a, b) => a.hoursLeft - b.hoursLeft),
    });

    let workout: TodayWorkoutView | null = null;
    let suggested = false;
    if (todayDay.planned) {
      const r = await musclesOf(todayDay.planned.templateId);
      if (r) workout = view(r.w, r.muscles, todayDay.planned.id);
    } else if (todayDay.kind !== 'done') {
      const options = [];
      for (const s of summaries) {
        const r = await musclesOf(s.id);
        if (!r) continue;
        const last = finished.find((f) => f.templateName === s.name);
        options.push({ id: s.id, name: s.name, muscles: r.muscles, lastDoneAt: last ? new Date(last.startedAt) : null, r });
      }
      const pick = pickTodayWorkout(options, recovering);
      const chosen = options.find((o) => o.id === pick?.id);
      if (chosen) {
        workout = { ...view(chosen.r.w, chosen.r.muscles, null),
          suggestedDaysAgo: chosen.lastDoneAt ? Math.max(0, Math.floor((now.getTime() - chosen.lastDoneAt.getTime()) / DAY)) : null };
        suggested = true;
      }
    }

    const next = advice.filter((a) => a.status === 'recovering').sort((a, b) => a.readyAt.getTime() - b.readyAt.getTime())[0];
    return {
      today, workout, suggested, hasWorkouts: summaries.length > 0, doneToday: todayDay.kind === 'done',
      cycleLine: cycle ? `${cycle.cycle.name}, semana ${cycle.pos.weekIndex + 1} de ${cycle.pos.block.weeks.length}` : null,
      cycleId: cycle?.cycle.id ?? null,
      week: strip, anyPlanned: planned.length > 0,
      streak: weeklyStreak(days.map((d) => d.date), today, this.settings.get('streakSessionsPerWeek')()),
      volume: volume ? { inRange: volume.inRange, total: volume.rows.length, progress: volume.progress } : null,
      recovery: { recovering: recovering.size, next: next ? { muscle: next.muscle, readyAt: next.readyAt } : null },
    };
  }
}
