#!/usr/bin/env node
/**
 * Converte catalogo-exercicios.md (as tuas tabelas por grupo muscular) na biblioteca da app:
 *   app/src/app/core/library/library.generated.ts
 *
 *   node tools/exercise-library/build-library.mjs
 *
 * A biblioteca é só de consulta: nada entra no teu catálogo até tocares em «Adicionar».
 * Regras (ver também docs/biblioteca.md):
 * - Cada célula divide-se por vírgulas fora de parênteses.
 * - Parênteses com vírgula ou «/» são variantes (vão para as notas); os outros ficam no nome.
 * - O mesmo exercício com o mesmo equipamento em duas secções junta-se num só item
 *   (a primeira secção dá o músculo principal, as seguintes entram como secundários).
 * - Nomes repetidos com equipamentos diferentes levam o equipamento entre parênteses.
 * - Músculo, medida e unilateral são inferidos por palavras-chave: são um ponto de partida,
 *   editável na app depois de adicionar.
 * - Cardio (passadeira, bicicleta, ...) entra como kind CARDIO, medido por duração, com o
 *   aparelho no nome («Passadeira: corrida contínua») e grupo próprio «Cardio».
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, 'catalogo-exercicios.md'), 'utf8');
const catalog = JSON.parse(readFileSync(resolve(here, '../import-excel/catalog.json'), 'utf8'));
const outPath = resolve(here, '../../app/src/app/core/library/library.generated.ts');

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const EQUIPMENT = {
  'halteres': 'dumbbell',
  'barra': 'barbell',
  'barra (olimpicos)': 'barbell',
  'maquina': 'machine',
  'cabos': 'cable',
  'elasticos': 'band',
  'kettlebell': 'kettlebell',
  'peso corporal': 'bodyweight',
  'halteres / kettlebell': 'dumbbell',
  'funcional': 'other',
};
const EQUIPMENT_SUFFIX = {
  dumbbell: 'halteres', barbell: 'barra', machine: 'máquina', cable: 'cabo', band: 'elástico',
  kettlebell: 'kettlebell', bodyweight: 'peso corporal', other: 'funcional',
};
/** Linhas de cardio: equipamento e nome usado no prefixo («Passadeira: caminhada»). */
const CARDIO_ROWS = {
  'passadeira': 'treadmill', 'bicicleta': 'bike', 'eliptica': 'elliptical',
  'remo ergometro': 'rower', 'escada / stepper': 'stair', 'ski erg': 'skierg',
};

/** Por secção: músculo/movimento por defeito e regras [regex, principal, secundários, movimento]. */
const SECTIONS = {
  'peito': {
    region: 'UPPER', primary: 'chest', secondary: ['triceps'], move: 'PUSH',
    rules: [[/pullover/, 'chest', ['back'], null], [/abertura|fly|crossover|peck deck|svend/, 'chest', [], 'PUSH']],
  },
  'costas': {
    region: 'UPPER', primary: 'back', secondary: ['biceps'], move: 'PULL',
    rules: [
      [/encolhiment/, 'traps', [], null],
      [/hiperextens|superman|banco romano/, 'lower_back', ['glutes'], null],
      [/good morning/, 'hamstrings', ['lower_back', 'glutes'], 'PULL'],
      [/peso morto|rack pull/, 'lower_back', ['hamstrings', 'glutes'], 'PULL'],
      [/swing/, 'glutes', ['hamstrings'], null],
      [/pullover|straight-arm/, 'back', [], 'PULL'],
      [/face pull|pull-apart|remada alta/, 'shoulders', ['traps'], 'PULL'],
    ],
  },
  'ombros': {
    region: 'UPPER', primary: 'shoulders', secondary: ['triceps'], move: 'PUSH',
    rules: [
      [/remada alta|face pull|pull-apart|posterior|invertido/, 'shoulders', ['traps'], 'PULL'],
      [/elevac|y-raise|lu raise/, 'shoulders', [], null],
      [/rotac|dislocates|halo|windmill|turkish/, 'shoulders', [], null],
    ],
  },
  'biceps e antebracos': {
    region: 'UPPER', primary: 'biceps', secondary: [], move: 'PULL',
    rules: [
      [/pulso|antebraco|farmer|rolo|dead hang|suspensao/, 'forearms', [], null],
      [/chin-up/, 'back', ['biceps'], 'PULL'],
      [/invertido|martelo|zottman/, 'biceps', ['forearms'], 'PULL'],
    ],
  },
  'triceps': {
    region: 'UPPER', primary: 'triceps', secondary: [], move: 'PUSH',
    rules: [[/supino|dips|floor press|flexoes diamante/, 'triceps', ['chest'], 'PUSH']],
  },
  'quadriceps': {
    region: 'LOWER', primary: 'quadriceps', secondary: ['glutes'], move: 'PUSH',
    rules: [
      [/sumo/, 'quadriceps', ['adductors', 'glutes'], 'PUSH'],
      [/extensao de perna|leg extension|sissy|terminal knee|spanish|wall sit/, 'quadriceps', [], 'PUSH'],
    ],
  },
  'isquiotibiais e gluteos': {
    region: 'LOWER', primary: 'glutes', secondary: ['hamstrings'], move: null,
    rules: [
      [/abduc|abdutor|clamshell|monster walk|passos laterais|fire hydrant/, 'abductors', ['glutes'], null],
      [/leg curl|nordic|glute-ham|slider|stiff|romeno|rdl|good morning|peso morto|deficit|deadlift|pull-through/,
        'hamstrings', ['glutes'], 'PULL'],
      [/hip thrust|ponte de gluteos|frog pump|kickback|donkey kick|reverse hyper|hiperextensoes/, 'glutes', ['hamstrings'], 'PUSH'],
      [/bulgaro|lunge|step-up/, 'glutes', ['quadriceps'], 'PUSH'],
      [/swing/, 'glutes', ['hamstrings'], null],
    ],
  },
  'gemeos, adutores e abdutores': {
    region: 'LOWER', primary: 'calves', secondary: [], move: null,
    rules: [
      [/abduc|abdutor|clamshell|side-lying/, 'abductors', [], null],
      [/aduc|adutor|copenhagen|lunge lateral|sumo/, 'adductors', [], null],
      [/tibial|flexao dorsal/, 'tibialis', [], null],
    ],
  },
  'core e abdominais': {
    region: 'CORE', primary: 'abs', secondary: [], move: null,
    rules: [
      [/obliquo|side bend|inclinacao lateral|russian twist|woodchop|rotac|windmill|roman chair|lateral|suitcase/, 'obliques', ['abs'], null],
      [/jefferson|bird dog/, 'lower_back', ['abs'], null],
      [/turkish/, 'abs', ['shoulders'], null],
    ],
  },
  'corpo inteiro, funcional e cardio': { region: 'FULL_BODY', primary: null, secondary: [], move: null, rules: [] },
};

const UNILATERAL = /\bunilateral\b(?!.*bilateral)|single-leg|bulgaro|\blunges?\b|step-up|split squat|pistol|shrimp|kroc|meadow row|bottoms-up|turkish|suitcase|copenhagen|side-lying|windmill|concentrado|clamshell|fire hydrant|donkey kick|kickback de gluteo|arqueiro|lu raise|1 perna/;
const HOLD = /prancha|plank|wall sit|hollow hold|l-sit|dead hang|suspensao na barra|pino na parede/;
const TIMED = /farmer|suitcase carry|battle ropes|corda de saltar|saltos de corda|bear crawl|sprints|empurrar\/puxar treno|monster walk|passos laterais/;

function splitCell(cell) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of cell) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
}

function parseItem(raw) {
  let name = raw;
  const variants = [];
  name = name.replace(/\s*\(([^)]*)\)/g, (m, inner) => {
    if (/[,/]|→/.test(inner)) {
      variants.push(inner.trim());
      return '';
    }
    return m;
  });
  return { name: cap(name.replace(/\s+/g, ' ').trim()), variants: variants.join('; ') || null };
}

function classify(sectionKey, nameFolded, variantsFolded, equipment) {
  const s = SECTIONS[sectionKey];
  let primary = s.primary;
  let secondary = [...s.secondary];
  let move = s.move;
  for (const [re, p, sec, mv] of s.rules) {
    if (re.test(nameFolded)) {
      primary = p;
      secondary = sec;
      move = mv;
      break;
    }
  }
  const text = `${nameFolded} ${variantsFolded}`;
  const isHold = HOLD.test(nameFolded);
  let metricType = 'WEIGHT_REPS';
  if (isHold || TIMED.test(nameFolded)) metricType = 'DURATION';
  else if (['bodyweight', 'band', 'other'].includes(equipment)) metricType = 'REPS';
  return {
    primary,
    secondary: secondary.filter((m) => m !== primary),
    move,
    metricType,
    isIsometric: isHold,
    isUnilateral: UNILATERAL.test(nameFolded),
  };
}

// ---- Ler as tabelas ----
const items = [];
const cardio = [];
let section = null;
for (const line of source.split('\n')) {
  const h = line.match(/^##\s+(.+)$/);
  if (h) {
    const key = fold(h[1].trim());
    section = SECTIONS[key] ? key : null;
    continue;
  }
  if (!section) continue;
  const row = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
  if (!row || /^-+$/.test(row[1]) || fold(row[1]) === 'equipamento') continue;
  const equipLabel = fold(row[1]);
  if (CARDIO_ROWS[equipLabel]) {
    for (const raw of splitCell(row[2])) {
      const { name, variants } = parseItem(raw);
      cardio.push({
        section: 'cardio', name: `${row[1].trim()}: ${name.charAt(0).toLowerCase()}${name.slice(1)}`, variants,
        equipment: CARDIO_ROWS[equipLabel], region: 'FULL_BODY', kind: 'CARDIO',
        category: /hiit|sprint|intervalo|saltar degraus/.test(fold(name)) ? 'HIIT' : 'CARDIO', primary: null, secondary: [],
        move: null, metricType: 'DURATION', isIsometric: false, isUnilateral: false,
      });
    }
    continue;
  }
  const equipment = EQUIPMENT[equipLabel];
  if (!equipment) throw new Error(`Equipamento desconhecido: "${row[1]}"`);
  for (const raw of splitCell(row[2])) {
    const { name, variants } = parseItem(raw);
    const c = classify(section, fold(name), fold(variants ?? ''), equipment);
    items.push({ section, name, variants, equipment, region: SECTIONS[section].region, ...c });
  }
}

// ---- Mobilidade: os 14 de catalog.json (seeds antigos) passam a viver na biblioteca ----
/** Categoria dos 14 de catalog.json (o resto da mobilidade vem de MOBILITY_EXTRA). */
const MOBILITY_CATEGORY = {
  '90/90 de anca': 'MOBILITY',
  'Alongamento de flexores da anca (couch stretch)': 'FLEXIBILITY',
  "World's greatest stretch": 'MOBILITY',
  'Pombo (pigeon)': 'FLEXIBILITY',
  'Agachamento profundo (manter)': 'MOBILITY',
  'Cossack squat': 'MOBILITY',
  'Mobilidade de tornozelo na parede': 'MOBILITY',
  'Gato-camelo': 'MINDBODY',
  'Rotação torácica em quadrupedia': 'MOBILITY',
  'Rotação torácica deitado (open book)': 'MOBILITY',
  'Alongamento de peitoral na porta': 'FLEXIBILITY',
  'Dislocates de ombro com banda': 'MOBILITY',
  'Posição da criança': 'MINDBODY',
  'Alongamento de isquiotibiais': 'FLEXIBILITY',
};
/**
 * Divisão por tipo de treino (ACSM, Cleveland Clinic): mobilidade dinâmica, alongamento estático,
 * equilíbrio/estabilidade e mind-body (yoga/pilates). [nome, categoria, medida, unilateral, áreas, equipamento]
 */
const MOBILITY_EXTRA = [
  ['Círculos de anca (CARs)', 'MOBILITY', 'REPS', true, ['hip'], null],
  ['Círculos de ombro (CARs)', 'MOBILITY', 'REPS', true, ['shoulder'], null],
  ['Alongamento de quadríceps em pé', 'FLEXIBILITY', 'DURATION', true, ['knee', 'hip'], null],
  ['Alongamento de gémeos na parede', 'FLEXIBILITY', 'DURATION', true, ['ankle'], null],
  ['Alongamento de adutores (borboleta)', 'FLEXIBILITY', 'DURATION', false, ['hip'], null],
  ['Alongamento de glúteos (figura 4)', 'FLEXIBILITY', 'DURATION', true, ['hip'], null],
  ['Alongamento de tríceps e ombro', 'FLEXIBILITY', 'DURATION', true, ['shoulder'], null],
  ['Alongamento de pescoço', 'FLEXIBILITY', 'DURATION', true, ['neck'], null],
  ['Equilíbrio num pé', 'BALANCE', 'DURATION', true, ['ankle', 'knee'], null],
  ['Equilíbrio num pé com olhos fechados', 'BALANCE', 'DURATION', true, ['ankle', 'knee'], null],
  ['Marcha calcanhar-ponta (tandem walk)', 'BALANCE', 'DURATION', false, ['ankle'], null],
  ['Star excursion (alcance em estrela num pé)', 'BALANCE', 'REPS', true, ['ankle', 'knee', 'hip'], null],
  ['Equilíbrio em bosu', 'BALANCE', 'DURATION', false, ['ankle'], 'other'],
  ['Cão a olhar para baixo (yoga)', 'MINDBODY', 'DURATION', false, ['shoulder', 'ankle'], null],
  ['Cobra (yoga)', 'MINDBODY', 'DURATION', false, ['lumbar', 'thoracic'], null],
  ['Guerreiro II (yoga)', 'MINDBODY', 'DURATION', true, ['hip', 'knee'], null],
  ['Saudação ao sol (yoga)', 'MINDBODY', 'REPS', false, ['thoracic', 'hip'], null],
  ['The hundred (pilates)', 'MINDBODY', 'DURATION', false, ['lumbar'], null],
  ['Roll-up (pilates)', 'MINDBODY', 'REPS', false, ['lumbar'], null],
];
const mobility = [
  ...catalog.mobility.map((m) => {
    if (!MOBILITY_CATEGORY[m.name]) throw new Error(`Mobilidade sem categoria: ${m.name}`);
    return [m.name, MOBILITY_CATEGORY[m.name], m.metricType, !!m.isUnilateral, m.areas ?? [], m.equipment ?? null];
  }),
  ...MOBILITY_EXTRA,
].map(([name, category, metricType, isUnilateral, areas, equipment]) => ({
  section: 'mobilidade', name, variants: null, equipment, region: null,
  kind: 'MOBILITY', category, primary: null, secondary: [], move: null, metricType,
  isIsometric: false, isUnilateral, mobilityAreas: areas,
}));
const areaKeys = new Set(catalog.mobilityAreas.map((a) => a.key));
for (const m of mobility) {
  for (const a of m.mobilityAreas) if (!areaKeys.has(a)) throw new Error(`${m.name}: área ${a} não existe`);
}

// ---- Juntar repetidos (mesmo nome + equipamento) ----
const merged = new Map();
for (const it of [...items, ...mobility, ...cardio]) {
  const k = `${fold(it.name)}|${it.equipment}`;
  const prev = merged.get(k);
  if (!prev) {
    merged.set(k, { ...it });
    continue;
  }
  for (const m of [it.primary, ...it.secondary]) {
    if (m && m !== prev.primary && !prev.secondary.includes(m)) prev.secondary.push(m);
  }
  if (it.variants && it.variants !== prev.variants) prev.variants = [prev.variants, it.variants].filter(Boolean).join('; ');
}

// ---- Nomes únicos ----
const byName = new Map();
for (const it of merged.values()) {
  const n = fold(it.name);
  byName.set(n, (byName.get(n) ?? 0) + 1);
}

/** Explosivos (potência): saltos, pliometria, levantamentos olímpicos, swings, arremessos. */
const POWER = /\b(salto|saltos|jump|jumps|jumping|clean|snatch|jerk|swing|slam|burpee|burpees|thruster|push press|corda de saltar|arremesso|high pull|bound)\b|pliom/;

const muscleKeys = new Set(catalog.muscles.map((m) => m.key));
const errors = [];
const library = [...merged.values()].map((it) => {
  const display = byName.get(fold(it.name)) > 1 && it.equipment ? `${it.name} (${EQUIPMENT_SUFFIX[it.equipment]})` : it.name;
  for (const m of [it.primary, ...it.secondary].filter(Boolean)) {
    if (!muscleKeys.has(m)) errors.push(`${display}: músculo ${m} não existe em catalog.json`);
  }
  return {
    key: `${slug(it.name)}--${it.equipment ?? 'none'}`,
    name: display,
    group: it.section,
    kind: it.kind ?? 'STRENGTH',
    category: it.category ?? (POWER.test(fold(display)) ? 'POWER' : 'STRENGTH'),
    metricType: it.metricType,
    isUnilateral: it.isUnilateral,
    isIsometric: it.isIsometric,
    region: it.region,
    movementType: it.move,
    equipment: it.equipment,
    primary: it.primary ? [it.primary] : [],
    secondary: it.secondary,
    mobilityAreas: it.mobilityAreas ?? [],
    variants: it.variants,
  };
});


// ---- Nomes em inglês (names-en.tsv): o nome passa a inglês, o português fica em namePt ----
const EN = new Map(
  readFileSync(resolve(here, 'names-en.tsv'), 'utf8').split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('\t').map((x) => x.trim())),
);
for (const l of library) {
  const en = EN.get(l.key);
  if (!en) errors.push(`Sem nome em inglês: ${l.key} (${l.name})`);
  l.namePt = l.name;
  l.name = en ?? l.name;
  l.source = 'catalog';
  l.mechanic = null;
  l.level = null;
}

// ---- free-exercise-db (domínio público): cruzar com o catálogo e trazer o resto ----
const FEDB = JSON.parse(readFileSync(resolve(here, 'free-exercise-db.json'), 'utf8'));
/** Correspondências que o nome não apanha sozinho (id do free-exercise-db → chave do catálogo). */
const ALIAS = {
  'Barbell_Bench_Press_-_Medium_Grip': 'supino-plano--barbell',
  'Barbell_Incline_Bench_Press_-_Medium_Grip': 'supino-inclinado--barbell',
  'Incline_Dumbbell_Press': 'supino-inclinado--dumbbell',
  'Dumbbell_Bench_Press_with_Neutral_Grip': 'supino-com-pega-neutra-squeeze-press--dumbbell',
  'One_Arm_Dumbbell_Bench_Press': 'supino-unilateral--dumbbell',
  'Barbell_Guillotine_Bench_Press': 'supino-guilhotina--barbell',
  'Butterfly': 'peck-deck-butterfly--machine',
  'Leverage_Incline_Chest_Press': 'chest-press-inclinado--machine',
  'Leverage_Decline_Chest_Press': 'chest-press-declinado--machine',
  'Barbell_Squat': 'agachamento-traseiro--barbell',
  'Barbell_Deadlift': 'peso-morto-convencional--barbell',
  'Trap_Bar_Deadlift': 'peso-morto-com-barra-hexagonal--barbell',
  'Stiff-Legged_Barbell_Deadlift': 'stiff--barbell',
  'Stiff-Legged_Dumbbell_Deadlift': 'peso-morto-stiff--dumbbell',
  'Pullups': 'dominadas--bodyweight',
  'Pushups': 'flexoes--bodyweight',
  'Dips_-_Chest_Version': 'dips-para-peito-tronco-inclinado--bodyweight',
  'Dips_-_Triceps_Version': 'dips-nas-paralelas-tronco-vertical--bodyweight',
  'Bent_Over_Barbell_Row': 'remada-curvada--barbell',
  'One-Arm_Dumbbell_Row': 'remada-unilateral-apoiada-no-banco--dumbbell',
  'Bent_Over_Two-Dumbbell_Row': 'remada-curvada-bilateral--dumbbell',
  'Dumbbell_Incline_Row': 'remada-no-banco-inclinado-chest-supported--dumbbell',
  'T-Bar_Row_with_Handle': 'remada-em-t-landmine--barbell',
  'Lying_T-Bar_Row': 'remada-em-t-com-apoio-de-peito--machine',
  'Wide-Grip_Lat_Pulldown': 'puxada-a-frente--cable',
  'One_Arm_Lat_Pulldown': 'puxada-unilateral--cable',
  'Seated_One-arm_Cable_Pulley_Rows': 'remada-unilateral-sentada--cable',
  'Standing_Military_Press': 'desenvolvimento-militar-de-pe--barbell',
  'Seated_Barbell_Military_Press': 'desenvolvimento-sentado--barbell',
  'Machine_Shoulder_Military_Press': 'shoulder-press--machine',
  'Side_Lateral_Raise': 'elevacoes-laterais--dumbbell',
  'Reverse_Flyes': 'elevacoes-posteriores-curvado-ou-no-banco-inclinado--dumbbell',
  'Reverse_Machine_Flyes': 'peck-deck-invertido-deltoide-posterior--machine',
  'Cable_Rear_Delt_Fly': 'crucifixo-invertido-nos-cabos--cable',
  'Barbell_Curl': 'curl-com-barra-reta--barbell',
  'Dumbbell_Bicep_Curl': 'curl-simultaneo--dumbbell',
  'Dumbbell_Alternate_Bicep_Curl': 'curl-alternado--dumbbell',
  'Cross_Body_Hammer_Curl': 'curl-cruzado-cross-body--dumbbell',
  'Standing_Biceps_Cable_Curl': 'curl-com-barra--cable',
  'Standing_One-Arm_Cable_Curl': 'curl-unilateral--cable',
  'Cable_Hammer_Curls_-_Rope_Attachment': 'curl-com-corda-martelo--cable',
  'Triceps_Pushdown': 'pushdown-com-barra-reta--cable',
  'Triceps_Pushdown_-_Rope_Attachment': 'pushdown-com-corda--cable',
  'Triceps_Pushdown_-_V-Bar_Attachment': 'pushdown-com-barra-v--cable',
  'Cable_Crunch': 'crunch-ajoelhado-com-corda--cable',
  'Hanging_Leg_Raise': 'elevacao-de-pernas-deitado-ou-suspenso-na-barra--bodyweight',
  'Dumbbell_Step_Ups': 'step-up--dumbbell',
  'Barbell_Step_Ups': 'step-up--barbell',
  'Dumbbell_Rear_Lunge': 'lunge-reverso--dumbbell',
  'Standing_Leg_Curl': 'leg-curl-de-pe-unilateral--machine',
  'Calf_Press_On_The_Leg_Press_Machine': 'gemeos-no-leg-press--machine',
};
const FEDB_EQUIPMENT = {
  barbell: 'barbell', 'e-z curl bar': 'barbell', dumbbell: 'dumbbell', cable: 'cable', machine: 'machine',
  kettlebells: 'kettlebell', bands: 'band', 'body only': 'bodyweight', 'medicine ball': 'other',
  'exercise ball': 'other', 'foam roll': 'other', other: 'other',
};
const FEDB_MUSCLE = {
  abdominals: 'abs', abductors: 'abductors', adductors: 'adductors', biceps: 'biceps', calves: 'calves',
  chest: 'chest', forearms: 'forearms', glutes: 'glutes', hamstrings: 'hamstrings', lats: 'lats',
  'lower back': 'lower_back', 'middle back': 'upper_back', traps: 'traps', quadriceps: 'quadriceps',
  shoulders: 'shoulders', triceps: 'triceps', neck: null,
};
const MUSCLE_GROUP = {
  chest: 'peito', lats: 'costas', upper_back: 'costas', traps: 'costas', lower_back: 'costas', shoulders: 'ombros',
  biceps: 'biceps e antebracos', forearms: 'biceps e antebracos', triceps: 'triceps', quadriceps: 'quadriceps',
  hamstrings: 'isquiotibiais e gluteos', glutes: 'isquiotibiais e gluteos', calves: 'gemeos, adutores e abdutores',
  adductors: 'gemeos, adutores e abdutores', abductors: 'gemeos, adutores e abdutores', abs: 'core e abdominais',
};
const MUSCLE_AREAS = {
  abdominals: ['lumbar'], abductors: ['hip'], adductors: ['hip'], calves: ['ankle'], chest: ['shoulder'],
  forearms: ['wrist'], glutes: ['hip'], hamstrings: ['hip', 'knee'], lats: ['shoulder'], 'lower back': ['lumbar'],
  'middle back': ['thoracic'], neck: ['neck'], quadriceps: ['knee', 'hip'], shoulders: ['shoulder'], traps: ['neck'],
  triceps: ['shoulder'], biceps: ['shoulder'],
};
const EQ_WORDS = {
  barbell: ['barbell', 'bar'], dumbbell: ['dumbbell'], cable: ['cable'], machine: ['machine', 'lever', 'leverage'],
  kettlebell: ['kettlebell'], band: ['band'], bodyweight: ['bodyweight'], other: [],
};
const SINGULAR = (w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const tokens = (name, equipment) => {
  const drop = new Set(['the', 'with', 'and', 'a', 'on', 'of', 'to', ...(EQ_WORDS[equipment] ?? [])]);
  const t = fold(name).replace(/\bpush up/g, 'push-up').replace(/\bpull up/g, 'pull-up').replace(/\bsit up/g, 'sit-up')
    .replace(/\bchin up/g, 'chin-up').replace(/flyes?\b/g, 'fly').match(/[a-z0-9'-]+/g) ?? [];
  return new Set(t.map(SINGULAR).filter((w) => !drop.has(w) && w !== '-'));
};
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

const byKey = new Map(library.map((l) => [l.key, l]));
const instructions = {};
const fedbOf = new Map(); // chave do catálogo → item do free-exercise-db
for (const f of FEDB) {
  const eq = FEDB_EQUIPMENT[f.equipment] ?? null;
  let target = ALIAS[f.id] ? byKey.get(ALIAS[f.id]) : null;
  if (ALIAS[f.id] && !target) errors.push(`Alias para chave inexistente: ${f.id}`);
  if (!target && eq) {
    const ft = tokens(f.name, eq);
    target = library.find((l) => l.source === 'catalog' && l.equipment === eq && !fedbOf.has(l.key) && sameSet(ft, tokens(l.name, eq)));
  }
  if (target && !fedbOf.has(target.key)) {
    fedbOf.set(target.key, f);
    target.fedbId = f.id;
    target.mechanic = f.mechanic === 'compound' ? 'COMPOUND' : f.mechanic === 'isolation' ? 'ISOLATION' : null;
    target.level = f.level ?? null;
    if (f.instructions?.length) instructions[target.key] = f.instructions;
    continue;
  }
  // Exercício novo.
  const cat = f.category;
  const kind = cat === 'stretching' ? 'MOBILITY' : cat === 'cardio' ? 'CARDIO' : 'STRENGTH';
  const category = kind === 'MOBILITY' ? 'FLEXIBILITY' : kind === 'CARDIO' ? 'CARDIO'
    : ['plyometrics', 'olympic weightlifting'].includes(cat) || POWER.test(fold(f.name)) ? 'POWER' : 'STRENGTH';
  const equipment = kind === 'MOBILITY' ? (eq && eq !== 'bodyweight' ? eq : null) : eq ?? 'bodyweight';
  const primary = kind === 'STRENGTH' ? f.primaryMuscles.map((m) => FEDB_MUSCLE[m]).filter(Boolean) : [];
  const secondary = kind === 'STRENGTH'
    ? f.secondaryMuscles.map((m) => FEDB_MUSCLE[m]).filter((m) => m && !primary.includes(m)) : [];
  const isometric = f.force === 'static' && kind === 'STRENGTH';
  const metricType = kind !== 'STRENGTH' || isometric ? 'DURATION'
    : ['bodyweight', 'band', 'other'].includes(equipment) ? 'REPS' : 'WEIGHT_REPS';
  const group = kind === 'MOBILITY' ? 'mobilidade' : kind === 'CARDIO' ? 'cardio'
    : ['plyometrics', 'olympic weightlifting', 'strongman'].includes(cat) ? 'corpo inteiro, funcional e cardio'
      : MUSCLE_GROUP[primary[0]] ?? 'corpo inteiro, funcional e cardio';
  const key = `${slug(f.id)}--fedb`;
  const areas = kind === 'MOBILITY' ? [...new Set([...f.primaryMuscles, ...f.secondaryMuscles].flatMap((m) => MUSCLE_AREAS[m] ?? []))] : [];
  library.push({
    key, name: f.name.trim(), namePt: null, group, kind, category, metricType,
    isUnilateral: /\b(one|single)[- ](arm|leg|legged)\b|unilateral|split squat|lunge|step[- ]?up|pistol|alternat(e|ing)/i.test(f.name),
    isIsometric: isometric,
    region: kind === 'MOBILITY' ? null : kind === 'CARDIO' ? 'FULL_BODY' : SECTIONS[group]?.region ?? 'FULL_BODY',
    movementType: kind === 'STRENGTH' ? (f.force === 'push' ? 'PUSH' : f.force === 'pull' ? 'PULL' : null) : null,
    equipment, primary, secondary, mobilityAreas: areas, variants: null,
    source: 'fedb', fedbId: f.id,
    mechanic: f.mechanic === 'compound' ? 'COMPOUND' : f.mechanic === 'isolation' ? 'ISOLATION' : null,
    level: f.level ?? null,
  });
  if (f.instructions?.length) instructions[key] = f.instructions;
}

// Nomes únicos depois de juntar: um nome repetido leva o equipamento (e, se preciso, a origem).
const EQ_EN = { dumbbell: 'Dumbbell', barbell: 'Barbell', machine: 'Machine', cable: 'Cable', band: 'Band',
  kettlebell: 'Kettlebell', bodyweight: 'Bodyweight', other: 'Other' };
{
  const seen = new Map();
  for (const l of library) {
    let n = fold(l.name);
    if (seen.has(n) && l.source === 'fedb') {
      l.name = `${l.name} (${EQ_EN[l.equipment] ?? 'alt'})`;
      n = fold(l.name);
      if (seen.has(n)) { l.name = `${l.name} [${l.fedbId}]`; n = fold(l.name); }
    }
    seen.set(n, l.key);
  }
}

const keys = new Set();
for (const l of library) {
  if (keys.has(l.key)) errors.push(`Chave repetida: ${l.key}`);
  keys.add(l.key);
}
const names = new Set();
for (const l of library) {
  if (names.has(fold(l.name))) errors.push(`Nome repetido: ${l.name}`);
  names.add(fold(l.name));
}
for (const l of library) {
  for (const m of [...l.primary, ...l.secondary]) if (!muscleKeys.has(m)) errors.push(`${l.name}: músculo ${m} não existe`);
  for (const a of l.mobilityAreas) if (!areaKeys.has(a)) errors.push(`${l.name}: área ${a} não existe`);
}
if (errors.length) {
  console.error('Biblioteca inválida:\n- ' + errors.join('\n- '));
  process.exit(1);
}

const GROUP_LABELS = {
  'peito': 'Peito', 'costas': 'Costas', 'ombros': 'Ombros', 'biceps e antebracos': 'Bíceps e antebraços',
  'triceps': 'Tríceps', 'quadriceps': 'Quadríceps', 'isquiotibiais e gluteos': 'Isquiotibiais e glúteos',
  'gemeos, adutores e abdutores': 'Gémeos, adutores e abdutores', 'core e abdominais': 'Core e abdominais',
  'corpo inteiro, funcional e cardio': 'Corpo inteiro e funcional',
  'mobilidade': 'Mobilidade',
  'cardio': 'Cardio',
};
const groups = [...Object.keys(SECTIONS), 'mobilidade', 'cardio'].map((k) => ({ key: k, label: GROUP_LABELS[k] }));

// JSON.parse de uma string é mais rápido de carregar do que um objeto literal deste tamanho.
const out = `// GERADO por tools/exercise-library/build-library.mjs (catalogo-exercicios.md + free-exercise-db). Não editar à mão.
import type { LibraryData } from './library-types';

export const LIBRARY_RAW: LibraryData = JSON.parse(${JSON.stringify(JSON.stringify({ version: 5, groups, items: library }))});
`;
writeFileSync(outPath, out);
const instrOut = `// GERADO por tools/exercise-library/build-library.mjs a partir do free-exercise-db (domínio público). Não editar à mão.
/** Instruções passo a passo (em inglês) por chave da biblioteca. Carrega-se só ao abrir um exercício. */
export const LIBRARY_INSTRUCTIONS: Record<string, string[]> = JSON.parse(${JSON.stringify(JSON.stringify(instructions))});
`;
writeFileSync(resolve(here, '../../app/src/app/core/library/library-instructions.generated.ts'), instrOut);

const count = (f) => library.filter(f).length;
console.log(`Biblioteca: ${library.length} exercícios (catálogo ${count((l) => l.source === 'catalog')}, free-exercise-db ${count((l) => l.source === 'fedb')}, cruzados ${fedbOf.size})`);
for (const g of groups) console.log(`  ${g.label}: ${count((l) => l.group === g.key)}`);
console.log(`  unilaterais: ${count((l) => l.isUnilateral)}, duração: ${count((l) => l.metricType === 'DURATION')}, reps: ${count((l) => l.metricType === 'REPS')}`);
console.log(`→ ${outPath}`);
