/** Os 16 músculos do spec e a correspondência com os grupos musculares guardados na base. */
export const SPEC_MUSCLES = [
  { id: 'peito', label: 'Peito' },
  { id: 'costas_dorsais', label: 'Dorsais' },
  { id: 'costas_superiores', label: 'Costas superiores' },
  { id: 'deltoide_anterior', label: 'Deltoide anterior' },
  { id: 'deltoide_lateral', label: 'Deltoide lateral' },
  { id: 'deltoide_posterior', label: 'Deltoide posterior' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'antebracos', label: 'Antebraços' },
  { id: 'quadriceps', label: 'Quadríceps' },
  { id: 'isquiotibiais', label: 'Isquiotibiais' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'gemeos', label: 'Gémeos' },
  { id: 'adutores', label: 'Adutores' },
  { id: 'abdominais', label: 'Abdominais' },
  { id: 'lombares', label: 'Lombares' },
] as const;

export type SpecMuscleId = (typeof SPEC_MUSCLES)[number]['id'];

/** Chave do grupo na base (muscle_group, via ids.muscle) → id do spec. Grupos fora da lista não contam. */
export const SPEC_MUSCLE_OF_KEY: Record<string, SpecMuscleId> = {
  chest: 'peito',
  lats: 'costas_dorsais',
  upper_back: 'costas_superiores',
  front_delt: 'deltoide_anterior',
  side_delt: 'deltoide_lateral',
  rear_delt: 'deltoide_posterior',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'antebracos',
  quadriceps: 'quadriceps',
  hamstrings: 'isquiotibiais',
  glutes: 'gluteos',
  abductors: 'gluteos',
  calves: 'gemeos',
  adductors: 'adutores',
  abs: 'abdominais',
  obliques: 'abdominais',
  lower_back: 'lombares',
};

export const MUSCLE_LABEL: Record<string, string> = Object.fromEntries(SPEC_MUSCLES.map((m) => [m.id, m.label]));
