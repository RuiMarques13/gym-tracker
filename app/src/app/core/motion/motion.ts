import { LEG_MOTIONS } from './motion-legs';
import { UPPER_MOTIONS } from './motion-upper';
import { BODY_MOTIONS } from './motion-body';
import { CARDIO_MOTIONS, MOBILITY_MOTIONS } from './motion-mobility';
import type { Motion } from './motion-core';

export type { Motion, Frame, Prop } from './motion-core';

/** Todas as animações, por id. */
export const MOTIONS: Record<string, Motion> = Object.fromEntries(
  [...LEG_MOTIONS, ...UPPER_MOTIONS, ...BODY_MOTIONS, ...MOBILITY_MOTIONS, ...CARDIO_MOTIONS].map((m) => [m.id, m]),
);

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Nome do exercício → animação. A primeira regra que casar ganha, por isso as específicas vêm primeiro.
 * Serve exercícios de força, mobilidade e cardio (os nomes da biblioteca e variantes comuns).
 */
const BY_NAME: Array<[RegExp, string]> = [
  // mobilidade
  [/90.?90/, 'mob-9090'], [/couch stretch/, 'mob-couch'], [/world.?s greatest/, 'mob-wgs'], [/pombo|pigeon/, 'mob-pigeon'],
  [/agachamento profundo/, 'mob-squat'], [/cossack|lunge lateral/, 'mob-cossack'], [/tornozelo/, 'mob-ankle'],
  [/gato|camelo/, 'mob-catcamel'], [/quadrupedia/, 'mob-thoracic'], [/open book/, 'mob-openbook'],
  [/peitoral na porta|alongamento de peitoral/, 'mob-pec'], [/dislocates|^halo/, 'mob-dislocate'],
  [/crianca/, 'mob-child'], [/alongamento de isquiotibiais|jefferson/, 'mob-hamstring'],
  // cardio
  [/farmer|suitcase carry/, 'carry'], [/remo ergometro/, 'rower'], [/jumping jack/, 'jackjump'], [/caminhada/, 'walk'], [/corrida|sprints|passadeira.*(hiit|intervalos)|^passadeira/, 'run'],
  [/^bicicleta:|air bike/, 'bike'], [/eliptica/, 'elliptical'],
  [/escada|stepper/, 'stairs'], [/ski erg/, 'skierg'],
  // anca e glúteos
  [/hip thrust|elevacao de anca/, 'hipthrust'], [/ponte de gluteo|frog pump/, 'bridge'],
  [/kickback de gluteo|glute kickback|donkey kick|fire hydrant/, 'kickback'],
  [/monster walk|passos laterais/, 'sidestep'],
  [/abducao|abdutor|clamshell|side-lying/, 'abduction'], [/aducao|adutor|copenhagen/, 'adduction'],
  // pernas
  [/leg curl (sentado|de pe)/, 'legcurl-seated'], [/leg curl|slider/, 'legcurl-lying'], [/nordic/, 'nordic'],
  [/glute-ham|ghr|hiperext|reverse hyper|superman/, 'hyper'],
  [/saltos de corda|corda de saltar/, 'rope'],
  [/gemeos.*sentado|sentado.*gemeos|calf.*sentado/, 'calf-seated'], [/gemeos|calf/, 'calf'], [/tibial/, 'tibialis'],
  [/extensao de perna|leg extension|sissy|terminal knee|spanish/, 'legext'],
  [/leg press|prensa|belt squat|v-squat/, 'legpress'], [/hack|pendulum/, 'hack'],
  [/pistol|shrimp/, 'pistol'], [/bulgaro|split squat/, 'split'], [/step-?up/, 'stepup'], [/lunge|afundo|passada/, 'lunge'],
  [/com salto|box jump|jumping jack/, 'jump'],
  [/agachamento frontal|front rack|zercher|overhead squat/, 'squat-front'], [/goblet/, 'goblet'], [/box squat/, 'squat-box'],
  [/wall sit/, 'wallsit'], [/agachamento sumo|sumo squat/, 'squat-sumo'], [/agachamento \(peso corporal|agachamento \(elastico/, 'squat-bw'], [/agachamento|squat/, 'squat'],
  // dobradiça da anca
  [/good morning/, 'goodmorning'], [/swing/, 'swing'], [/pull-through/, 'pullthrough'],
  [/peso morto romeno|stiff|rdl|single-leg dead/, 'hinge'], [/peso morto|deadlift|rack pull|saco de areia/, 'deadlift'],
  // funcional
  [/clean/, 'clean'], [/snatch/, 'snatch'], [/thruster|wall ball/, 'thruster'],
  [/burpee|devil press|man maker/, 'burpee'], [/battle rope/, 'ropes'], [/slam/, 'slam'],
  [/treno|sled|pneu/, 'sled'], [/bear crawl/, 'birddog'], [/^trx|remada invertida/, 'trxrow'],
  // peito
  [/dips|paralelas/, 'dips'],
  [/chest press.*(de pe|cabos)/, 'chestpress-standing'], [/chest press.*inclinado/, 'chestpress-incline'],
  [/chest press.*declinado/, 'chestpress-decline'], [/chest press/, 'chestpress'],
  [/(supino|chest press).*inclinado/, 'bench-incline'], [/(supino|chest press).*declinado/, 'bench-decline'],
  [/pullover.*(corda|straight)|straight-arm/, 'straightarm'], [/pullover/, 'pullover'],
  [/peck deck invertido|crucifixo invertido|posterior/, 'rear-raise'],
  [/aberturas|flye|\bfly\b|crossover|peck deck/, 'fly'],
  [/flexoes (em )?pike|pike push|\bpino|handstand/, 'pushup-pike'], [/flexoes|push-?up/, 'pushup'],
  [/desenvolvimento sentado|shoulder press/, 'press-seated'],
  [/supino|floor press|chest press|guilhotina|squeeze press|svend/, 'bench'],
  // costas
  [/remada alta/, 'upright'], [/face pull|pull-apart/, 'facepull'],
  [/remada unilateral (apoiada|$)|remada kroc|remada unilateral$|remada renegada|remada gorila|meadow/, 'row-one'],
  [/remada.*sentada|remada seal|chest-supported|apoio de peito|banco inclinado/, 'row-seated'], [/remada|row/, 'row-bent'],
  [/puxada|pulldown/, 'pulldown'], [/dominada|chin-?up/, 'pullup'], [/suspensao|dead hang/, 'hang'], [/encolh|shrug/, 'shrug'],
  // ombros
  [/rotacoes? (externas|internas)|rotacoes externas/, 'rotation-ext'],
  [/elevac\w* lateral|elevacoes laterais|y-raise|lu raise/, 'lateral'], [/elevac\w* frontal|elevacoes frontais/, 'front-raise'],
  [/desenvolvimento|arnold|bradford|bottoms-up|press militar|push press|push jerk|landmine press/, 'press'],
  [/turkish/, 'situp'], [/windmill|side bend|inclinacao lateral/, 'sidebend'],
  // braços
  [/curl de pulso|rolo de pulso|antebraco/, 'wrist-curl'], [/martelo|zottman/, 'curl-hammer'],
  [/bayesian|curl inclinado/, 'curl-incline'], [/scott|preacher|spider|concentrado/, 'curl-preacher'], [/curl|rosca/, 'curl'],
  [/pushdown|extensao cruzada|maquina de triceps|extensoes de triceps/, 'pushdown'],
  [/extensao acima da cabeca|francesa/, 'tri-overhead'], [/skull|jm press|tate|extensao deitado/, 'skull'], [/kickback/, 'kickback-tri'],
  // core
  [/prancha|plank|stir the pot/, 'plank'], [/rollout|ab wheel/, 'rollout'],
  [/toes-to-bar|elevacao de pernas|captain|l-sit|dragon flag/, 'legraise'], [/v-ups/, 'vup'], [/mountain/, 'climber'],
  [/dead bug/, 'deadbug'], [/bird dog/, 'birddog'], [/pallof|anti-rotacao/, 'pallof'],
  [/russian|woodchop|rotacao|landmine rotation|roman chair|obliquo/, 'twist'],
  [/sit-up/, 'situp'], [/crunch|bicicleta|hollow|abdominal|banco declinado/, 'crunch'],
];

const BY_MUSCLE: Record<string, string> = {
  peito: 'bench', costas_dorsais: 'pulldown', costas_superiores: 'row-bent', deltoide_anterior: 'press', deltoide_lateral: 'lateral',
  deltoide_posterior: 'rear-raise', biceps: 'curl', triceps: 'pushdown', quadriceps: 'squat', isquiotibiais: 'hinge',
  gluteos: 'hipthrust', gemeos: 'calf', abdominais: 'crunch', lombares: 'hyper', adutores: 'adduction', antebracos: 'wrist-curl',
};

/** Animação do exercício: pelo nome; em força, sem pista no nome, pelo músculo principal. */
export function motionFor(name: string, primaryMuscles: readonly string[], kind: 'STRENGTH' | 'MOBILITY' | 'CARDIO' = 'STRENGTH'): Motion | null {
  const n = norm(name);
  for (const [re, id] of BY_NAME) if (re.test(n)) return MOTIONS[id] ?? null;
  if (kind !== 'STRENGTH') return null;
  for (const m of primaryMuscles) if (BY_MUSCLE[m]) return MOTIONS[BY_MUSCLE[m]];
  return null;
}
