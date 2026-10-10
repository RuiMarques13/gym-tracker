export type Kind = 'STRENGTH' | 'MOBILITY';
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
};

export const METRIC_LABEL: Record<MetricType, string> = {
  WEIGHT_REPS: 'Carga × reps',
  REPS: 'Repetições',
  DURATION: 'Duração',
};
