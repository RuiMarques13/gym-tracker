/**
 * Porções que cada exercício trabalha, com papel, confiança e fonte (estudo «Músculos por exercício»).
 *
 * Confiança:
 * - A: um estudo testou este exercício (com este material, quando o estudo o diz);
 * - B: herdado do exercício testado mais parecido;
 * - C: só pela função anatómica do músculo (nenhuma medição).
 *
 * Regras por família de nome (inglês e português), a primeira que casar ganha. Os grupos guardados no exercício
 * que a regra não cobre entram como confiança C, para o boneco nunca perder o que o exercício diz trabalhar.
 */
import { PORTION, PORTIONS_OF_KEY, type PortionId } from './portions';

export type Confidence = 'A' | 'B' | 'C';
export type Role = 'primary' | 'secondary';

export interface PortionInfo {
  role: Role;
  confidence: Confidence;
  /** Chaves de SOURCES. */
  sources: string[];
}

export interface PortionProfile {
  primary: PortionId[];
  secondary: PortionId[];
  info: Partial<Record<PortionId, PortionInfo>>;
  /** Nome da família que casou (null = só os grupos guardados). */
  family: string | null;
}

interface Part {
  p?: PortionId[];
  s?: PortionId[];
  /** Confiança quando o material do exercício está em `eqA` (ou sempre, sem `eqA`); fora disso desce para B. */
  conf: Confidence;
  eqA?: string[];
  src: string[];
}

interface Rule {
  family: string;
  re: RegExp;
  not?: RegExp;
  parts: Part[];
}

const TRI: PortionId[] = ['triceps_long', 'triceps_lateral', 'triceps_medial'];
const PEC: PortionId[] = ['pec_clavicular', 'pec_sternal', 'pec_costal'];
const VASTI: PortionId[] = ['vastus_lateralis', 'vastus_medialis', 'vastus_intermedius'];
const HAMS: PortionId[] = ['biceps_femoris_long', 'semitendinosus', 'semimembranosus'];
const ANAT = ['physiopedia'];

const RULES: Rule[] = [
  // ---- tríceps ----
  { family: 'Extensão de tríceps por cima da cabeça', re: /overhead (cable |rope |dumbbell |band )?triceps|triceps overhead|overhead extension|extensao acima da cabeca|french press|extensao francesa/,
    parts: [{ p: ['triceps_long'], s: ['triceps_lateral', 'triceps_medial'], conf: 'A', eqA: ['cable'], src: ['maeo2022'] }] },
  { family: 'Pushdown de tríceps', re: /pushdown|push-down/,
    not: /incline pushdown/,
    parts: [{ p: TRI, conf: 'A', eqA: ['cable'], src: ['maeo2022'] }] },
  { family: 'Extensão de tríceps', re: /skull crusher|lying triceps|tate press|jm press|triceps kickback|kickback(?!.*glute)|triceps extension|triceps dip|bench dip|dip machine|machine dip|assisted dip/,
    not: /glute|chest dip|leg/,
    parts: [{ p: TRI, conf: 'B', src: ['maeo2022'] }] },
  // ---- peito ----
  { family: 'Supino fechado / flexões diamante', re: /close-grip (barbell |dumbbell |smith machine )?(bench |floor )?press|close-grip dumbbell press|smith machine close-grip|diamond push|close triceps|reverse triceps bench|close-grip push|supino fechado|flexoes diamante/,
    not: /incline/,
    parts: [{ p: TRI, s: ['pec_sternal', 'delt_front'], conf: 'C', src: ANAT }] },
  { family: 'Supino inclinado', re: /incline (barbell |dumbbell |smith machine |close-grip )?(bench )?press|incline chest press|incline db bench press|supino inclinado/,
    not: /curl/,
    parts: [{ p: ['pec_clavicular'], s: ['delt_front', 'pec_sternal'], conf: 'A', eqA: ['barbell'], src: ['ridao2020'] }] },
  { family: 'Supino plano', re: /bench press|chest press|floor press|push-?up|supino|flexoes|squeeze press|guillotine|svend|chest dip|dips para peito/,
    not: /pike|handstand|incline(?! push)/,
    parts: [{ p: PEC, s: ['delt_front', 'triceps_medial'], conf: 'A', eqA: ['barbell'], src: ['ridao2020'] }] },
  { family: 'Crucifixo / aberturas', re: /\bfly\b|flyes?\b|crossover|pec deck|aberturas|butterfly/,
    not: /reverse|rear|invertid|back fl|jump/,
    parts: [{ p: PEC, s: ['delt_front'], conf: 'A', eqA: ['dumbbell', 'band'], src: ['bergquist2018'] }] },
  // ---- ombros ----
  { family: 'Deltoide posterior (crucifixo invertido)', re: /reverse fly|back fly|rear lateral|rear delt|reverse pec deck|reverse machine fly|crucifixo invertido|peck deck invertido|elevacoes posteriores/,
    parts: [{ p: ['delt_rear'], s: ['trap_upper', 'delt_side'], conf: 'A', eqA: ['dumbbell', 'band'], src: ['bergquist2018'] }] },
  { family: 'Face pull / pull-apart', re: /face pull|pull-apart/,
    parts: [{ p: ['delt_rear', 'trap_middle'], s: ['infraspinatus', 'rhomboids'], conf: 'C', src: ANAT }] },
  { family: 'Elevações em prono (I-Y-T)', re: /y-raise|i-y-t|prone .*raise|elevacao do braco em prono/,
    parts: [{ p: ['trap_lower', 'trap_middle', 'infraspinatus'], conf: 'A', src: ['ace2018', 'ekstrom2003'] }] },
  { family: 'Elevação lateral', re: /lateral raise|elevac\w* laterais?|side lateral/,
    not: /front|rear/,
    parts: [{ p: ['delt_side', 'delt_rear'], s: ['delt_front'], conf: 'A', eqA: ['dumbbell'], src: ['campos2020'] }] },
  { family: 'Elevação frontal', re: /front raise|front delt raise|elevac\w* fronta/,
    parts: [{ p: ['delt_front'], s: ['delt_side'], conf: 'C', src: ANAT }] },
  { family: 'Remada alta', re: /upright row|row to neck|remada alta/,
    parts: [{ p: ['delt_side', 'trap_upper'], s: ['delt_front'], conf: 'C', src: ANAT }] },
  { family: 'Press de ombros', re: /shoulder press|overhead press|military|push press|push jerk|arnold|desenvolvimento|bradford|landmine press|pike push|handstand|behind-the-neck press/,
    parts: [{ p: ['delt_front', 'delt_side'], s: ['delt_rear', 'triceps_lateral'], conf: 'A', eqA: ['dumbbell'], src: ['campos2020'] }] },
  { family: 'Encolhimentos', re: /shrug|encolh/,
    parts: [{ p: ['trap_upper'], conf: 'B', src: ['ekstrom2003'] }] },
  { family: 'Rotação do ombro', re: /external rotation|internal rotation|shoulder rotation|rotac\w* extern|cuban/,
    parts: [{ p: ['infraspinatus'], s: ['delt_rear'], conf: 'C', src: ANAT }] },
  // ---- costas ----
  { family: 'Pullover / braços esticados', re: /straight-arm|pullover|incline pushdown/,
    not: /delt raise/,
    parts: [{ p: ['lats'], s: ['triceps_long', 'pec_sternal'], conf: 'B', src: ['ace2018'] }] },
  { family: 'Barra fixa / chin-up', re: /pull-?ups?\b|chin-?ups?\b|dominada/,
    not: /scapular|pull-through|band-assisted.*row/,
    parts: [{ p: ['lats'], s: ['infraspinatus', 'biceps'], conf: 'A', eqA: ['bodyweight', 'machine', 'band'], src: ['ace2018'] }] },
  { family: 'Puxada', re: /pulldown|puxada/,
    parts: [{ p: ['lats'], s: ['biceps', 'trap_lower'], conf: 'A', eqA: ['cable'], src: ['ace2018'] }] },
  { family: 'Remada invertida', re: /inverted row|remada invertida|trx row|suspended row|bodyweight mid row/,
    parts: [{ p: ['trap_middle'], s: ['lats', 'infraspinatus'], conf: 'A', src: ['ace2018'] },
      { s: ['rhomboids'], conf: 'C', src: ANAT }] },
  { family: 'Remada com apoio de peito', re: /chest-supported|seal row|lying t-bar|apoio de peito|incline row|dumbbell incline row/,
    parts: [{ p: ['trap_middle'], s: ['lats', 'trap_lower'], conf: 'B', src: ['ace2018'] }, { s: ['rhomboids'], conf: 'C', src: ANAT }] },
  { family: 'Remada sentada', re: /seated (cable |lever |band )?row|remada sentada|cable row|machine row|lever row|high row|iso row|smith machine row|kneeling high pulley row/,
    parts: [{ p: ['trap_middle'], s: ['lats'], conf: 'A', eqA: ['cable', 'machine'], src: ['ace2018'] }, { s: ['rhomboids'], conf: 'C', src: ANAT }] },
  { family: 'Remada curvada', re: /bent[- ]over.*row|remada curvada|pendlay|yates|t-bar row|reverse grip bent|landmine t-bar/,
    parts: [{ p: ['trap_middle', 'trap_lower', 'erectors'], s: ['lats', 'infraspinatus'], conf: 'A', eqA: ['barbell', 'dumbbell'], src: ['ace2018'] },
      { s: ['rhomboids'], conf: 'C', src: ANAT }] },
  { family: 'Remada unilateral', re: /\brow\b|remada/,
    not: /upright|rower|rowing/,
    parts: [{ p: ['trap_middle', 'trap_lower'], s: ['lats', 'infraspinatus'], conf: 'B', src: ['ace2018'] }, { s: ['rhomboids'], conf: 'C', src: ANAT }] },
  // ---- dobradiça da anca e posteriores ----
  { family: 'Extensão da anca a 45° (hiperextensão)', re: /45|roman chair back extension|back extension|hyperextension|hiperext/,
    not: /reverse|glute-focused|enfase gluteo/,
    parts: [{ p: HAMS, conf: 'A', eqA: ['bodyweight', 'machine'], src: ['bourne2017'] }, { s: ['erectors', 'glute_max'], conf: 'C', src: ANAT }] },
  { family: 'Hiperextensão com ênfase no glúteo', re: /glute-focused back extension|reverse hyper|enfase gluteo/,
    parts: [{ p: ['glute_max'], s: HAMS, conf: 'C', src: ANAT }] },
  { family: 'Superman', re: /superman/, parts: [{ p: ['erectors'], s: ['glute_max'], conf: 'C', src: ANAT }] },
  { family: 'Leg curl sentado', re: /seated (leg|hamstring|band hamstring) curl|leg curl sentado/,
    parts: [{ p: HAMS, conf: 'A', eqA: ['machine'], src: ['maeo2021'] }, { s: ['biceps_femoris_short'], conf: 'C', src: ANAT }] },
  { family: 'Nordic', re: /nordic|glute-ham|glute ham/,
    parts: [{ p: ['semitendinosus'], conf: 'A', eqA: ['bodyweight', 'machine'], src: ['bourne2017'] },
      { s: ['biceps_femoris_long', 'semimembranosus'], conf: 'B', src: ['bourne2017'] }] },
  { family: 'Leg curl', re: /leg curl|leg curls|slider leg curl|ball leg curl|hamstring curl/,
    parts: [{ p: HAMS, conf: 'A', eqA: ['machine'], src: ['maeo2021'] }, { s: ['biceps_femoris_short', 'gastroc_medial'], conf: 'C', src: ANAT }] },
  { family: 'Peso morto romeno / stiff', re: /romanian|\brdl\b|stiff|good morning|peso morto romeno|single-leg deadlift|one-legged deadlift/,
    parts: [{ p: HAMS, conf: 'B', src: ['bourne2017'] }, { s: ['glute_max', 'erectors'], conf: 'C', src: ANAT }] },
  { family: 'Peso morto', re: /deadlift|peso morto|rack pull/,
    parts: [{ p: ['glute_max'], conf: 'A', eqA: ['barbell'], src: ['neto2020'] }, { p: HAMS, s: ['erectors', 'trap_upper', 'adductors'], conf: 'C', src: ANAT }] },
  { family: 'Hip thrust / ponte', re: /hip thrust|glute bridge|frog pump|ponte de gluteo|butt lift/,
    parts: [{ p: ['glute_max'], conf: 'A', eqA: ['barbell', 'band'], src: ['neto2020'] }, { s: HAMS, conf: 'C', src: ANAT }] },
  { family: 'Kickback de glúteo', re: /glute kickback|one-legged cable kickback|kickback de gluteo|donkey kick/,
    parts: [{ p: ['glute_max'], s: HAMS, conf: 'C', src: ANAT }] },
  { family: 'Abdução da anca', re: /abduct|abducao|abdutor|clamshell|lateral walk|monster walk|side-lying leg raise|fire hydrant|side plank.*abduction|passos laterais/,
    parts: [{ p: ['glute_med'], s: ['glute_max'], conf: 'A', eqA: ['machine', 'band', 'bodyweight'], src: ['macadam2015'] }, { s: ['glute_min'], conf: 'C', src: ANAT }] },
  { family: 'Adução da anca', re: /adduct|aducao|adutor|copenhagen/,
    parts: [{ p: ['adductors'], conf: 'A', eqA: ['band', 'bodyweight'], src: ['serner2014'] }] },
  // ---- quadríceps ----
  { family: 'Extensão de pernas', re: /leg extension|extensao de perna|sissy|spanish squat|terminal knee/,
    parts: [{ p: ['rectus_femoris'], s: VASTI, conf: 'A', eqA: ['machine'], src: ['kinoshita2026'] }] },
  { family: 'Leg press', re: /leg press|hack squat|pendulum|v-squat|lying machine squat/,
    not: /calf/,
    parts: [{ p: VASTI, s: ['rectus_femoris'], conf: 'A', eqA: ['machine'], src: ['kinoshita2026'] }, { s: ['glute_max'], conf: 'C', src: ANAT }] },
  { family: 'Step-up', re: /step-?up/,
    parts: [{ p: ['glute_max'], conf: 'A', src: ['neto2020'] }, { p: VASTI, s: ['rectus_femoris'], conf: 'B', src: ['kinoshita2026'] }] },
  { family: 'Lunge / split squat', re: /lunge|split squat|bulgarian|bulgaro|afundo/,
    not: /turkish/,
    parts: [{ p: ['glute_max'], conf: 'A', src: ['neto2020'] }, { p: VASTI, s: ['rectus_femoris', 'adductors'], conf: 'B', src: ['kinoshita2026'] }] },
  { family: 'Agachamento', re: /squat|agachamento|thruster|wall ball|wall sit/,
    not: /turkish|get-up|kneeling (jump )?squat/,
    parts: [{ p: ['glute_max'], conf: 'A', eqA: ['barbell', 'machine'], src: ['neto2020'] },
      { p: VASTI, s: ['rectus_femoris'], conf: 'B', src: ['kinoshita2026'] }, { s: ['adductors', 'erectors'], conf: 'C', src: ANAT }] },
  // ---- gémeos e tibial ----
  { family: 'Gémeos sentado', re: /seated (dumbbell |barbell |one-leg )?calf|calf.*seated|gemeos sentado|seated calf/,
    parts: [{ p: ['soleus'], s: ['gastroc_medial', 'gastroc_lateral'], conf: 'A', src: ['kinoshita2023'] }] },
  { family: 'Gémeos em pé', re: /calf|gemeos|donkey/,
    not: /stretch/,
    parts: [{ p: ['gastroc_medial', 'gastroc_lateral'], s: ['soleus'], conf: 'A', src: ['kinoshita2023'] }] },
  { family: 'Tibial', re: /tibialis|dorsiflexion|flexao dorsal/, parts: [{ p: ['tibialis'], conf: 'C', src: ANAT }] },
  // ---- braços ----
  { family: 'Curl martelo / invertido', re: /hammer curl|hammer dumbbell curl|martelo|zottman|reverse (barbell |cable |plate |dumbbell )?curl|curl invertido|reverse grip curl/,
    parts: [{ p: ['brachialis', 'forearm'], s: ['biceps'], conf: 'C', src: ANAT }] },
  { family: 'Curl de pulso / antebraço', re: /wrist|pulso|forearm|antebraco|farmer|finger curl|dead hang/,
    parts: [{ p: ['forearm'], conf: 'C', src: ANAT }] },
  { family: 'Curl Scott / concentrado', re: /preacher|scott|spider curl|concentration|concentrado/,
    parts: [{ p: ['biceps', 'brachialis'], conf: 'B', src: ['kassiano2025'] }] },
  { family: 'Curl inclinado', re: /incline (dumbbell |inner biceps )?curl|curl inclinado|bayesian|drag curl|curls lying against an incline/,
    parts: [{ p: ['biceps', 'brachialis'], conf: 'B', src: ['kassiano2025'] }] },
  { family: 'Curl de bíceps', re: /curl|rosca/,
    not: /leg|hamstring|nordic|jefferson|wrist|finger/,
    parts: [{ p: ['biceps', 'forearm'], conf: 'A', eqA: ['barbell', 'dumbbell'], src: ['marcolin2018'] }, { s: ['brachialis'], conf: 'C', src: ANAT }] },
  // ---- core ----
  { family: 'Prancha lateral / roll-out', re: /side plank|roll-?out|ab wheel|prancha lateral/,
    parts: [{ p: ['rectus_upper', 'rectus_lower', 'obliques'], conf: 'A', src: ['kawama2022'] }] },
  { family: 'Oblíquos (rotação e inclinação)', re: /oblique|obliquo|russian twist|woodchop|side bend|pallof|rotation|anti-rotation|windmill|suitcase|torso rotation|inclinacao lateral/,
    parts: [{ p: ['obliques'], s: ['rectus_upper', 'rectus_lower'], conf: 'C', src: ANAT }] },
  { family: 'Elevação de pernas', re: /leg raise|knee raise|toes-to-bar|captain|l-sit|v-up|dragon flag|reverse crunch|elevacao de pernas|scissor|flutter/,
    not: /side-lying|side leg|jump/,
    parts: [{ p: ['rectus_lower'], s: ['rectus_upper'], conf: 'A', eqA: ['bodyweight'], src: ['marchetti2011'] }] },
  { family: 'Crunch / sit-up', re: /crunch|curl-up|sit-up|abdominal|ab crunch|jackknife/,
    parts: [{ p: ['rectus_upper'], s: ['rectus_lower'], conf: 'A', eqA: ['bodyweight'], src: ['marchetti2011'] }] },
  { family: 'Prancha e anti-extensão', re: /plank|prancha|hollow|dead bug|bird dog|stir the pot|mountain climber/,
    parts: [{ p: ['rectus_upper', 'rectus_lower'], s: ['obliques'], conf: 'C', src: ANAT }] },
];

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface ProfileInput {
  name: string;
  namePt?: string | null;
  /** Chave do equipamento (barbell, dumbbell, cable, machine, band, bodyweight, kettlebell, other) ou null. */
  equipment: string | null;
  /** Chaves dos grupos guardados no exercício (chest, lats, triceps…). */
  primaryKeys: readonly string[];
  secondaryKeys: readonly string[];
  kind?: string;
}

/** A família que casa com o nome (inglês ou português), ou null. */
export function familyOf(name: string, namePt?: string | null): string | null {
  return ruleOf(name, namePt)?.family ?? null;
}

function ruleOf(name: string, namePt?: string | null): Rule | null {
  const n = `${fold(name)} | ${fold(namePt ?? '')}`;
  return RULES.find((r) => r.re.test(n) && !(r.not && r.not.test(n))) ?? null;
}

export function portionsFor(input: ProfileInput): PortionProfile {
  const info: Partial<Record<PortionId, PortionInfo>> = {};
  const set = (id: PortionId, role: Role, confidence: Confidence, sources: string[]) => {
    const cur = info[id];
    // principal ganha a secundário; com o mesmo papel, fica a confiança mais alta
    if (cur && (cur.role === 'primary' && role === 'secondary')) return;
    if (cur && cur.role === role && cur.confidence <= confidence) return;
    info[id] = { role, confidence, sources };
  };
  const rule = input.kind && input.kind !== 'STRENGTH' ? null : ruleOf(input.name, input.namePt);
  if (rule) {
    for (const part of rule.parts) {
      const conf: Confidence = part.conf === 'A' && part.eqA && !(input.equipment && part.eqA.includes(input.equipment)) ? 'B' : part.conf;
      for (const id of part.p ?? []) set(id, 'primary', conf, part.src);
      for (const id of part.s ?? []) set(id, 'secondary', conf, part.src);
    }
  }
  // Grupos guardados que a regra não cobre: entram pela anatomia (C), com o papel guardado.
  const covered = new Set(Object.keys(info).map((id) => PORTION[id as PortionId].group ?? id));
  const addKeys = (keys: readonly string[], role: Role) => {
    for (const k of keys) {
      const ps = PORTIONS_OF_KEY[k] ?? [];
      if (!ps.length || ps.some((p) => covered.has(PORTION[p].group ?? p))) continue;
      for (const p of ps) set(p, role, 'C', ANAT);
    }
  };
  addKeys(input.primaryKeys, 'primary');
  addKeys(input.secondaryKeys, 'secondary');
  const ids = Object.keys(info) as PortionId[];
  return {
    primary: ids.filter((id) => info[id]!.role === 'primary'),
    secondary: ids.filter((id) => info[id]!.role === 'secondary'),
    info,
    family: rule?.family ?? null,
  };
}
