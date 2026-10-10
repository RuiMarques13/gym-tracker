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
        equipment: CARDIO_ROWS[equipLabel], region: 'FULL_BODY', kind: 'CARDIO', primary: null, secondary: [],
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
const mobility = catalog.mobility.map((m) => ({
  section: 'mobilidade', name: m.name, variants: null, equipment: m.equipment ?? null, region: null,
  kind: 'MOBILITY', primary: null, secondary: [], move: null, metricType: m.metricType,
  isIsometric: false, isUnilateral: !!m.isUnilateral, mobilityAreas: m.areas ?? [],
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

const out = `// GERADO por tools/exercise-library/build-library.mjs a partir de catalogo-exercicios.md. Não editar à mão.
import type { LibraryData } from './library-types';

export const LIBRARY_RAW: LibraryData = ${JSON.stringify({ version: 3, groups, items: library }, null, 2)};
`;
writeFileSync(outPath, out);

const count = (f) => library.filter(f).length;
console.log(`Biblioteca: ${library.length} exercícios (${items.length + mobility.length + cardio.length - library.length} repetidos juntados)`);
for (const g of groups) console.log(`  ${g.label}: ${count((l) => l.group === g.key)}`);
console.log(`  unilaterais: ${count((l) => l.isUnilateral)}, duração: ${count((l) => l.metricType === 'DURATION')}, reps: ${count((l) => l.metricType === 'REPS')}`);
console.log(`→ ${outPath}`);
