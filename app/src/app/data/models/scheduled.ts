import type { ScheduledStatus } from './enums';

export interface ScheduledWorkout {
  id: string;
  /** «YYYY-MM-DD», hora local. */
  date: string;
  templateId: string;
  templateName: string;
  status: ScheduledStatus;
  /** Ciclo que o criou (semana-tipo); null = planeado teu. */
  cycleId: string | null;
}

export const STATUS_LABEL: Record<ScheduledStatus, string> = {
  PLANNED: 'Planeado',
  DONE: 'Feito',
  SKIPPED: 'Saltado',
};

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleError';
  }
}

/** Estado de um planeado do ciclo, para a lógica de calendário (core/progression/cycle-schedule). */
export interface CycleScheduledRow {
  id: string;
  date: string;
  templateId: string;
  status: ScheduledStatus;
  cycleId: string | null;
  deleted: boolean;
}
