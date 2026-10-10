import type { ScheduledStatus } from './enums';

export interface ScheduledWorkout {
  id: string;
  /** «YYYY-MM-DD», hora local. */
  date: string;
  templateId: string;
  templateName: string;
  status: ScheduledStatus;
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
