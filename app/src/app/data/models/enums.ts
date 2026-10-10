export type Kind = 'STRENGTH' | 'MOBILITY' | 'CARDIO';
/**
 * Categoria: a divisão fina que se vê na app (força, potência, cardio, HIIT, mobilidade, alongamento,
 * equilíbrio, yoga/pilates). Cada uma pertence a um `Kind`, que é quem decide o comportamento
 * (RIR, descanso, mapa muscular, medidas permitidas) e as restrições da base de dados.
 */
export type Category =
  | 'STRENGTH' | 'POWER'
  | 'CARDIO' | 'HIIT'
  | 'MOBILITY' | 'FLEXIBILITY' | 'BALANCE' | 'MINDBODY';
export type MetricType = 'WEIGHT_REPS' | 'REPS' | 'DURATION';
export type Region = 'UPPER' | 'LOWER' | 'CORE' | 'FULL_BODY';
export type MovementType = 'PUSH' | 'PULL';
/**
 * Blocos de um treino. Só há dois: qualquer exercício (força, mobilidade ou cardio) pode estar em qualquer um.
 * A base ainda aceita 'MOBILITY' (migração 001), mas a app nunca o escreve; ao ler, passa a 'MAIN'.
 */
export type Block = 'WARMUP' | 'MAIN';
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

export const CATEGORY_LABEL: Record<Category, string> = {
  STRENGTH: 'Força',
  POWER: 'Potência',
  CARDIO: 'Cardio contínuo',
  HIIT: 'HIIT / intervalos',
  MOBILITY: 'Mobilidade',
  FLEXIBILITY: 'Alongamento',
  BALANCE: 'Equilíbrio',
  MINDBODY: 'Yoga / Pilates',
};

export const CATEGORY_HINT: Record<Category, string> = {
  STRENGTH: 'Resistência com carga ou peso corporal: hipertrofia, força máxima, resistência muscular.',
  POWER: 'Explosivo: saltos, pliometria, levantamentos olímpicos, swings, arremessos.',
  CARDIO: 'Aeróbico a ritmo estável (zona 2): passadeira, bicicleta, remo, elíptica.',
  HIIT: 'Blocos intensos com pausas: sprints, intervalos, tabata.',
  MOBILITY: 'Amplitude ativa e controlo articular (dinâmico).',
  FLEXIBILITY: 'Alongamento estático: manter a posição no limite confortável.',
  BALANCE: 'Equilíbrio, estabilidade e controlo neuromotor (apoio unipodal, bosu).',
  MINDBODY: 'Yoga, pilates, tai chi: respiração, controlo e flexibilidade combinados.',
};

/** Comportamento (Kind) de cada categoria. */
export const KIND_OF_CATEGORY: Record<Category, Kind> = {
  STRENGTH: 'STRENGTH',
  POWER: 'STRENGTH',
  CARDIO: 'CARDIO',
  HIIT: 'CARDIO',
  MOBILITY: 'MOBILITY',
  FLEXIBILITY: 'MOBILITY',
  BALANCE: 'MOBILITY',
  MINDBODY: 'MOBILITY',
};

export const CATEGORIES: Category[] = [
  'STRENGTH', 'POWER', 'CARDIO', 'HIIT', 'MOBILITY', 'FLEXIBILITY', 'BALANCE', 'MINDBODY',
];

export const CATEGORIES_BY_KIND: Record<Kind, Category[]> = {
  STRENGTH: ['STRENGTH', 'POWER'],
  CARDIO: ['CARDIO', 'HIIT'],
  MOBILITY: ['MOBILITY', 'FLEXIBILITY', 'BALANCE', 'MINDBODY'],
};

/** Categoria por omissão de cada Kind (também a usada quando a base ainda não tem categoria). */
export function defaultCategory(kind: Kind): Category {
  return CATEGORIES_BY_KIND[kind][0];
}

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as string[]).includes(v);
}

/** Categoria guardada, ou a por omissão do Kind se estiver vazia ou não pertencer a esse Kind. */
export function resolveCategory(kind: Kind, stored: string | null | undefined): Category {
  return isCategory(stored) && KIND_OF_CATEGORY[stored] === kind ? stored : defaultCategory(kind);
}
