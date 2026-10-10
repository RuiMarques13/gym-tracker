/**
 * Perfil muscular curado por família de exercício (cinesiologia clássica: EMG e tabelas tipo ExRx/Delavier).
 * Substitui o que as regras por secção do catálogo inferiram. Primeira regra que casar com o nome ganha,
 * por isso as mais específicas vêm primeiro. Chaves = grupos musculares guardados.
 */
export interface Profile {
  primary: string[];
  secondary: string[];
}
const P = (primary: string[], secondary: string[] = []): Profile => ({ primary, secondary });

export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const RULES: Array<[RegExp, Profile]> = [
  [/leg curl|nordic|slider/, P(['hamstrings'], ['calves', 'glutes'])],
  [/jefferson/, P(['lower_back', 'hamstrings'], ['abs'])],
  [/face pull|crucifixo invertido|posterior|invertido.*deltoide|peck deck invertido|pull-apart/, P(['rear_delt'], ['upper_back'])],
  [/\bpino|handstand|pike/, P(['front_delt'], ['side_delt', 'triceps', 'upper_back'])],
  [/straight-arm|pulldown.*corda/, P(['lats'], ['triceps', 'abs'])],
  [/chest-supported|apoio de peito|seal|apoiada no banco|banco inclinado/, P(['lats', 'upper_back'], ['biceps', 'rear_delt'])],
  // ---- Peito ----
  [/pullover/, P(['lats', 'chest'], ['triceps'])],
  [/svend|squeeze press|peck|butterfly|aberturas|crossover|\bfly|flye/, P(['chest'], ['front_delt'])],
  [/guilhotina/, P(['chest'], ['front_delt', 'triceps'])],
  [/supino.*pega.*fechada|pega fechada|floor press.*fechada/, P(['triceps'], ['chest', 'front_delt'])],
  [/dips.*(peito|inclinado)/, P(['chest'], ['triceps', 'front_delt'])],
  [/dips|paralelas/, P(['triceps', 'chest'], ['front_delt'])],
  [/landmine press/, P(['front_delt', 'chest'], ['triceps', 'abs'])],
  [/flexoes.*diamante/, P(['triceps'], ['chest', 'front_delt'])],
  [/flexoes|chest press|supino|floor press/, P(['chest'], ['front_delt', 'triceps'])],
  // ---- Ombros ----
  [/remada alta/, P(['side_delt', 'upper_back'], ['biceps', 'front_delt'])],
  [/elevacao frontal|elevacoes frontais/, P(['front_delt'], ['side_delt', 'chest'])],
  [/elevacoes? laterais frontais/, P(['side_delt', 'front_delt'])],
  [/elevacao lateral|elevacoes laterais/, P(['side_delt'], ['upper_back'])],
  [/y-raise|lu raise/, P(['side_delt', 'rear_delt'], ['upper_back'])],
  [/rotacoes? (externas|internas)|rotacoes externas/, P(['rear_delt'], ['upper_back'])],
  [/dislocates|halo/, P(['front_delt', 'rear_delt'], ['upper_back', 'abs'])],
  [/turkish/, P(['front_delt', 'abs'], ['glutes', 'obliques', 'triceps'])],
  [/windmill/, P(['obliques', 'side_delt'], ['glutes', 'hamstrings'])],
  [/push press|push jerk/, P(['front_delt', 'quadriceps'], ['side_delt', 'triceps', 'glutes'])],
  [/desenvolvimento|shoulder press|arnold|bradford|bottoms-up/, P(['front_delt', 'side_delt'], ['triceps', 'upper_back'])],
  // ---- Costas ----
  [/encolh/, P(['upper_back'], ['forearms'])],
  [/pullover/, P(['lats'], ['chest'])],
  [/superman/, P(['lower_back'], ['glutes', 'upper_back', 'rear_delt'])],
  [/hiperext.*gluteo|reverse hyper/, P(['glutes', 'hamstrings'], ['lower_back'])],
  [/hiperext/, P(['lower_back'], ['glutes', 'hamstrings'])],
  [/rack pull/, P(['upper_back', 'lower_back'], ['glutes', 'hamstrings', 'forearms', 'lats'])],
  [/pendlay|yates|remada curvada|remada kroc|meadow|remada em t|remada na smith|remada no banco inclinado|remada seal|remada gorila|remada renegada|remada invertida/,
    P(['lats', 'upper_back'], ['biceps', 'rear_delt', 'lower_back'])],
  [/remada sentada de alavanca|remada sentada|remada unilateral|remada/, P(['lats', 'upper_back'], ['biceps', 'rear_delt'])],
  [/chin-up|pega supinada/, P(['lats', 'biceps'], ['upper_back', 'forearms'])],
  [/dominadas|puxada/, P(['lats'], ['biceps', 'upper_back', 'rear_delt'])],
  // ---- Bíceps / antebraços / tríceps ----
  [/preacher|maquina de biceps/, P(['biceps'], ['forearms'])],
  [/^kickback \(/, P(['triceps'])],
  [/martelo|zottman/, P(['biceps'], ['forearms'])],
  [/invertido/, P(['forearms', 'biceps'])],
  [/curl de pulso|rolo de pulso|antebraco/, P(['forearms'])],
  [/farmer|suspensao na barra|dead hang/, P(['forearms'], ['upper_back', 'abs'])],
  [/curl|rosca|drag curl/, P(['biceps'], ['forearms'])],
  [/extensao acima da cabeca|francesa|skull|jm press|tate press|extensoes de triceps|extensao deitado/, P(['triceps'])],
  [/pushdown|kickback.*cabo|kickback.*triceps|extensao cruzada|maquina de triceps|kickback$/, P(['triceps'])],
  // ---- Pernas ----
  [/sumo.*adut|lunge lateral|aducao|adutores|copenhagen/, P(['adductors'], ['glutes'])],
  [/abducao|abdutor|clamshell|monster walk|passos laterais|fire hydrant|side-lying/, P(['abductors', 'glutes'])],
  [/tibial|flexao dorsal/, P(['tibialis'])],
  [/gemeos|calf|saltos de corda/, P(['calves'])],
  [/leg extension|extensao de perna|sissy|terminal knee|spanish|wall sit/, P(['quadriceps'])],
  [/leg curl|nordic|slider/, P(['hamstrings'], ['calves', 'glutes'])],
  [/glute-ham|ghr/, P(['hamstrings', 'glutes'], ['lower_back', 'calves'])],
  [/hip thrust|ponte de gluteos|frog pump|kickback de gluteo|glute kickback|donkey kick/, P(['glutes'], ['hamstrings', 'adductors'])],
  [/pull-through/, P(['glutes', 'hamstrings'], ['lower_back'])],
  [/peso morto sumo|sumo deadlift/, P(['glutes', 'adductors', 'quadriceps'], ['hamstrings', 'lower_back', 'upper_back', 'forearms'])],
  [/peso morto romeno|stiff|rdl|single-leg deadlift|peso morto stiff/, P(['hamstrings', 'glutes'], ['lower_back', 'forearms', 'upper_back'])],
  [/good morning/, P(['hamstrings', 'glutes', 'lower_back'], ['abs'])],
  [/deadlift|peso morto/, P(['glutes', 'hamstrings', 'quadriceps', 'lower_back'], ['upper_back', 'forearms', 'lats', 'abs'])],
  [/bulgaro com tronco inclinado|lunge reverso|step-up alto/, P(['glutes', 'quadriceps'], ['hamstrings', 'adductors'])],
  [/bulgaro|split squat|lunge|step-up|shrimp|pistol|afundo/, P(['quadriceps', 'glutes'], ['hamstrings', 'adductors', 'calves'])],
  [/agachamento sumo|goblet|front rack|zercher|frontal|overhead squat|v-squat|belt squat/, P(['quadriceps', 'glutes'], ['adductors', 'abs', 'lower_back'])],
  [/hack|pendulum|leg press|agachamento na smith/, P(['quadriceps'], ['glutes', 'adductors'])],
  [/agachamento|squat|box squat/, P(['quadriceps', 'glutes'], ['adductors', 'hamstrings', 'lower_back', 'abs'])],
  // ---- Core ----
  [/pallof|anti-rotacao|dead bug|bird dog/, P(['abs', 'obliques'], ['glutes'])],
  [/jefferson/, P(['lower_back', 'hamstrings'], ['abs'])],
  [/oblic|side bend|inclinacao lateral|russian|woodchop|rotacao|roman chair|suitcase|landmine rotation/, P(['obliques'], ['abs'])],
  [/rollout|ab wheel|stir the pot|dragon flag|hollow|l-sit|prancha|plank/, P(['abs'], ['front_delt', 'obliques', 'lats'])],
  [/mountain climber/, P(['abs'], ['front_delt', 'quadriceps', 'obliques'])],
  [/toes-to-bar|elevacao de pernas|captain|v-ups/, P(['abs'], ['forearms', 'lats', 'quadriceps'])],
  [/crunch|sit-up|abdominal|bicicleta|banco declinado/, P(['abs'], ['obliques'])],
  // ---- Corpo inteiro / funcional ----
  [/clean and jerk/, P(['glutes', 'quadriceps', 'front_delt'], ['hamstrings', 'upper_back', 'triceps', 'lower_back'])],
  [/snatch/, P(['glutes', 'quadriceps', 'upper_back'], ['hamstrings', 'front_delt', 'side_delt', 'lower_back', 'triceps'])],
  [/clean/, P(['glutes', 'quadriceps', 'upper_back'], ['hamstrings', 'lower_back', 'biceps', 'forearms'])],
  [/thruster|wall ball/, P(['quadriceps', 'glutes', 'front_delt'], ['triceps', 'side_delt', 'abs'])],
  [/devil press|man maker|burpee/, P(['chest', 'quadriceps', 'front_delt'], ['triceps', 'glutes', 'abs', 'hamstrings'])],
  [/swing/, P(['glutes', 'hamstrings'], ['lower_back', 'abs', 'front_delt', 'forearms'])],
  [/box jump|jumping jack|sprint|corda de saltar/, P(['quadriceps', 'calves', 'glutes'], ['hamstrings'])],
  [/slam/, P(['abs', 'lats'], ['front_delt', 'triceps', 'glutes'])],
  [/battle rope/, P(['front_delt', 'abs'], ['biceps', 'forearms', 'upper_back'])],
  [/treno|sled|virar pneu/, P(['quadriceps', 'glutes'], ['hamstrings', 'calves', 'abs', 'upper_back'])],
  [/bear crawl/, P(['front_delt', 'abs'], ['quadriceps', 'triceps', 'chest'])],
  [/saco de areia/, P(['glutes', 'lower_back', 'abs'], ['quadriceps', 'upper_back', 'forearms'])],
  [/trx/, P(['lats', 'upper_back'], ['biceps', 'rear_delt', 'abs'])],
];

/** Perfil curado de um exercício de força, ou null se nenhuma regra casar (mantém o inferido). */
export function profileFor(name: string): Profile | null {
  const n = norm(name);
  for (const [re, p] of RULES) if (re.test(n)) return { primary: [...p.primary], secondary: [...p.secondary] };
  return null;
}
