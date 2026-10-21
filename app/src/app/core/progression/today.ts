import { weekDays, weekStartOf } from '../util/week';

/**
 * Home: a semana em 7 dias e o treino a sugerir quando nada está planeado para hoje. Só junta dados (treinos feitos,
 * planeados, recuperação por músculo); a dose de treino continua nas regras de progressão.
 */

export interface DaySession {
  /** «YYYY-MM-DD» local. */
  date: string;
  name: string | null;
}

export interface DayPlanned {
  id: string;
  date: string;
  templateId: string;
  name: string;
  status: 'PLANNED' | 'DONE' | 'SKIPPED';
}

export type DayKind = 'done' | 'planned' | 'missed' | 'skipped' | 'empty';

export interface WeekDay {
  date: string;
  /** 0 = segunda. */
  weekday: number;
  kind: DayKind;
  today: boolean;
  future: boolean;
  /** Nome do treino feito ou planeado; null num dia vazio ou numa sessão livre. */
  name: string | null;
  /** Planeado ainda por fazer nesse dia. */
  planned: DayPlanned | null;
}

/**
 * Os 7 dias da semana de `today`: feito (há sessão terminada), planeado (futuro ou hoje), falhado (passado, planeado e
 * não feito), saltado, ou vazio.
 */
export function weekStrip(today: string, sessions: readonly DaySession[], planned: readonly DayPlanned[]): WeekDay[] {
  return weekDays(weekStartOf(today)).map((date, weekday) => {
    const done = sessions.filter((s) => s.date === date);
    const plan = planned.filter((p) => p.date === date);
    const open = plan.find((p) => p.status === 'PLANNED') ?? null;
    const base = { date, weekday, today: date === today, future: date > today };
    if (done.length) return { ...base, kind: 'done', name: done.find((s) => s.name)?.name ?? null, planned: date === today ? open : null };
    if (!plan.length) return { ...base, kind: 'empty', name: null, planned: null };
    const p = open ?? plan[0];
    const kind: DayKind = p.status === 'SKIPPED' ? 'skipped' : p.status === 'DONE' ? 'done' : date < today ? 'missed' : 'planned';
    return { ...base, kind, name: p.name, planned: kind === 'planned' ? p : null };
  });
}

export interface WorkoutOption {
  id: string;
  name: string;
  /** Músculos principais (ids do spec) dos exercícios do treino. */
  muscles: readonly string[];
  /** Última vez que foi feito; null = nunca. */
  lastDoneAt: Date | null;
}

/**
 * Treino a sugerir sem plano para hoje (rules.ts `today.suggest`; escolha da app): entre os treinos com músculos
 * principais, os que não têm nenhum músculo ainda a recuperar; desses, o feito há mais tempo (nunca feito primeiro).
 */
export function pickTodayWorkout(options: readonly WorkoutOption[], recovering: ReadonlySet<string>): WorkoutOption | null {
  const fit = options.filter((o) => o.muscles.length && !o.muscles.some((m) => recovering.has(m)));
  if (!fit.length) return null;
  const t = (o: WorkoutOption) => (o.lastDoneAt ? o.lastDoneAt.getTime() : -Infinity);
  return [...fit].sort((a, b) => t(a) - t(b) || a.name.localeCompare(b.name, 'pt'))[0];
}
