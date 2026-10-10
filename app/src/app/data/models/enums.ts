export type Kind = 'STRENGTH' | 'MOBILITY' | 'CARDIO';
export type MetricType = 'WEIGHT_REPS' | 'REPS' | 'DURATION';
export type Region = 'UPPER' | 'LOWER' | 'CORE' | 'FULL_BODY';
export type MovementType = 'PUSH' | 'PULL';
export type Block = 'WARMUP' | 'MAIN' | 'MOBILITY';
export type SetType = 'WARMUP' | 'WORKING';
export type Side = 'BOTH' | 'LEFT' | 'RIGHT';
export type ScheduledStatus = 'PLANNED' | 'DONE' | 'SKIPPED';
export type SettingScope = 'ACCOUNT' | 'DEVICE' | 'LAYOUT';

export const REGION_LABEL: Record<Region, string> = {
  UPPER: 'Superior',
  LOWER: 'Inferior',
  CORE: 'Core',
  FULL_BODY: 'Full body',
};

export const KIND_LABEL: Record<Kind, string> = {
  STRENGTH: 'Força',
  MOBILITY: 'Mobilidade',
  CARDIO: 'Cardio',
};

/** Medidas permitidas por tipo de exercício. */
export const METRICS_BY_KIND: Record<Kind, MetricType[]> = {
  STRENGTH: ['WEIGHT_REPS', 'REPS', 'DURATION'],
  MOBILITY: ['REPS', 'DURATION'],
  CARDIO: ['DURATION'],
};

export const MOVEMENT_LABEL: Record<MovementType, string> = { PUSH: 'Push', PULL: 'Pull' };

export const METRIC_LABEL: Record<MetricType, string> = {
  WEIGHT_REPS: 'Carga × reps',
  REPS: 'Repetições',
  DURATION: 'Duração',
};
