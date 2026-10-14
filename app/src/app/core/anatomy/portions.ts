/**
 * Porções musculares do boneco (estudo «Músculos por exercício», mapa anatómico alvo).
 * Cada porção pertence a um dos 16 grupos do spec (volume semanal) ou a nenhum (só desenho).
 * Funções anatómicas de referência: Physiopedia (cita Floyd, Neumann e Moore); ver SOURCES.
 */
import type { SpecMuscleId } from '../metrics/muscles';

export type PortionId =
  | 'trap_upper' | 'trap_middle' | 'trap_lower' | 'rhomboids' | 'lats' | 'infraspinatus' | 'serratus' | 'erectors'
  | 'delt_front' | 'delt_side' | 'delt_rear'
  | 'pec_clavicular' | 'pec_sternal' | 'pec_costal'
  | 'biceps' | 'brachialis' | 'forearm'
  | 'triceps_long' | 'triceps_lateral' | 'triceps_medial'
  | 'rectus_upper' | 'rectus_lower' | 'obliques'
  | 'glute_max' | 'glute_med' | 'glute_min' | 'adductors'
  | 'rectus_femoris' | 'vastus_lateralis' | 'vastus_medialis' | 'vastus_intermedius'
  | 'biceps_femoris_long' | 'biceps_femoris_short' | 'semitendinosus' | 'semimembranosus'
  | 'gastroc_medial' | 'gastroc_lateral' | 'soleus' | 'tibialis';

export interface Portion {
  id: PortionId;
  label: string;
  /** Grupo do spec onde conta para o volume; null = só desenho. */
  group: SpecMuscleId | null;
  /** Fica por baixo de outro músculo: no boneco só se vê a parte que chega à superfície. */
  deep?: boolean;
}

export const PORTIONS: Portion[] = [
  { id: 'trap_upper', label: 'Trapézio superior', group: 'costas_superiores' },
  { id: 'trap_middle', label: 'Trapézio médio', group: 'costas_superiores' },
  { id: 'trap_lower', label: 'Trapézio inferior', group: 'costas_superiores' },
  { id: 'rhomboids', label: 'Romboides', group: 'costas_superiores', deep: true },
  { id: 'infraspinatus', label: 'Infraespinhoso', group: 'costas_superiores' },
  { id: 'lats', label: 'Grande dorsal', group: 'costas_dorsais' },
  { id: 'serratus', label: 'Serrátil anterior', group: null },
  { id: 'erectors', label: 'Eretores da coluna', group: 'lombares' },
  { id: 'delt_front', label: 'Deltoide anterior', group: 'deltoide_anterior' },
  { id: 'delt_side', label: 'Deltoide lateral', group: 'deltoide_lateral' },
  { id: 'delt_rear', label: 'Deltoide posterior', group: 'deltoide_posterior' },
  { id: 'pec_clavicular', label: 'Peitoral (porção clavicular)', group: 'peito' },
  { id: 'pec_sternal', label: 'Peitoral (porção esternal)', group: 'peito' },
  { id: 'pec_costal', label: 'Peitoral (porção costal)', group: 'peito' },
  { id: 'biceps', label: 'Bíceps braquial', group: 'biceps' },
  { id: 'brachialis', label: 'Braquial', group: 'biceps', deep: true },
  { id: 'forearm', label: 'Antebraço (braquiorradial e flexores)', group: 'antebracos' },
  { id: 'triceps_long', label: 'Tríceps (cabeça longa)', group: 'triceps' },
  { id: 'triceps_lateral', label: 'Tríceps (cabeça lateral)', group: 'triceps' },
  { id: 'triceps_medial', label: 'Tríceps (cabeça medial)', group: 'triceps', deep: true },
  { id: 'rectus_upper', label: 'Reto abdominal (parte alta)', group: 'abdominais' },
  { id: 'rectus_lower', label: 'Reto abdominal (parte baixa)', group: 'abdominais' },
  { id: 'obliques', label: 'Oblíquos', group: 'abdominais' },
  { id: 'glute_max', label: 'Glúteo máximo', group: 'gluteos' },
  { id: 'glute_med', label: 'Glúteo médio', group: 'gluteos' },
  { id: 'glute_min', label: 'Glúteo mínimo', group: 'gluteos', deep: true },
  { id: 'adductors', label: 'Adutores', group: 'adutores' },
  { id: 'rectus_femoris', label: 'Reto femoral', group: 'quadriceps' },
  { id: 'vastus_lateralis', label: 'Vasto lateral', group: 'quadriceps' },
  { id: 'vastus_medialis', label: 'Vasto medial', group: 'quadriceps' },
  { id: 'vastus_intermedius', label: 'Vasto intermédio', group: 'quadriceps', deep: true },
  { id: 'biceps_femoris_long', label: 'Bíceps femoral (cabeça longa)', group: 'isquiotibiais' },
  { id: 'biceps_femoris_short', label: 'Bíceps femoral (cabeça curta)', group: 'isquiotibiais', deep: true },
  { id: 'semitendinosus', label: 'Semitendinoso', group: 'isquiotibiais' },
  { id: 'semimembranosus', label: 'Semimembranoso', group: 'isquiotibiais', deep: true },
  { id: 'gastroc_medial', label: 'Gastrocnémio medial', group: 'gemeos' },
  { id: 'gastroc_lateral', label: 'Gastrocnémio lateral', group: 'gemeos' },
  { id: 'soleus', label: 'Sóleo', group: 'gemeos', deep: true },
  { id: 'tibialis', label: 'Tibial anterior', group: null },
];

export const PORTION: Record<PortionId, Portion> = Object.fromEntries(PORTIONS.map((p) => [p.id, p])) as Record<PortionId, Portion>;

/**
 * Grupo guardado na base (chave do catálogo) → porções por defeito (confiança C: só pela anatomia).
 * Usado quando nenhum perfil cobre esse grupo, para o boneco nunca perder o que o exercício diz trabalhar.
 */
export const PORTIONS_OF_KEY: Record<string, PortionId[]> = {
  chest: ['pec_clavicular', 'pec_sternal', 'pec_costal'],
  lats: ['lats'],
  back: ['lats'],
  upper_back: ['trap_middle', 'trap_lower', 'rhomboids'],
  traps: ['trap_upper'],
  front_delt: ['delt_front'],
  side_delt: ['delt_side'],
  rear_delt: ['delt_rear'],
  shoulders: ['delt_side'],
  biceps: ['biceps', 'brachialis'],
  forearms: ['forearm'],
  triceps: ['triceps_long', 'triceps_lateral', 'triceps_medial'],
  abs: ['rectus_upper', 'rectus_lower'],
  obliques: ['obliques'],
  lower_back: ['erectors'],
  glutes: ['glute_max'],
  abductors: ['glute_med', 'glute_min'],
  adductors: ['adductors'],
  quadriceps: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius'],
  hamstrings: ['biceps_femoris_long', 'biceps_femoris_short', 'semitendinosus', 'semimembranosus'],
  calves: ['gastroc_medial', 'gastroc_lateral', 'soleus'],
  tibialis: ['tibialis'],
};
