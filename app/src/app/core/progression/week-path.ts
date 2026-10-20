import { weekDays, weekStartOf } from '../util/week';

/**
 * Caminho da semana na Home: um passo por dia com treino feito ou planeado, mais o dia de hoje. Só junta dados;
 * não decide nada de treino (o plano vem dos Planeados e dos Ciclos).
 */

export interface PathSession {
  /** «YYYY-MM-DD» local do início. */
  date: string;
  name: string | null;
}

export interface PathPlanned {
  id: string;
  date: string;
  templateId: string;
  name: string;
  status: 'PLANNED' | 'DONE' | 'SKIPPED';
}

export type StepKind = 'done' | 'today' | 'planned' | 'missed' | 'skipped' | 'rest';

export interface PathStep {
  date: string;
  /** 0 = segunda. */
  weekday: number;
  kind: StepKind;
  /** Nome do treino (feito ou planeado); null num dia de descanso ou sessão livre sem nome. */
  name: string | null;
  /** Treinos feitos nesse dia. */
  sessions: number;
  /** Planeado a iniciar (hoje ou a seguir). */
  planned: PathPlanned | null;
}

/**
 * Passos da semana de `today`:
 * - dia com treino terminado: «done» (com o nome do primeiro);
 * - hoje sem treino: «today» (com o planeado de hoje, se houver), sempre presente;
 * - dia futuro com planeado: «planned»; dia passado com planeado por fazer: «missed»; saltado: «skipped»;
 * - os outros dias não aparecem, salvo o descanso de hoje já com treino feito (fica «done»).
 */
export function weekPath(today: string, sessions: readonly PathSession[], planned: readonly PathPlanned[]): PathStep[] {
  const week = weekStartOf(today);
  const days = weekDays(week);
  const out: PathStep[] = [];
  days.forEach((date, weekday) => {
    const done = sessions.filter((s) => s.date === date);
    const plan = planned.filter((p) => p.date === date);
    const open = plan.find((p) => p.status === 'PLANNED') ?? null;
    if (done.length) {
      out.push({ date, weekday, kind: 'done', name: done.find((s) => s.name)?.name ?? null, sessions: done.length, planned: null });
      // Treinou e ainda há outro planeado para hoje: aparece a seguir.
      if (date === today && open) out.push({ date, weekday, kind: 'today', name: open.name, sessions: 0, planned: open });
      return;
    }
    if (date === today) {
      out.push({ date, weekday, kind: 'today', name: open?.name ?? null, sessions: 0, planned: open });
      return;
    }
    if (!plan.length) return;
    const p = open ?? plan[0];
    const kind: StepKind = p.status === 'SKIPPED' ? 'skipped' : date < today ? (p.status === 'DONE' ? 'done' : 'missed') : 'planned';
    out.push({ date, weekday, kind, name: p.name, sessions: 0, planned: kind === 'planned' ? p : null });
  });
  return out;
}
