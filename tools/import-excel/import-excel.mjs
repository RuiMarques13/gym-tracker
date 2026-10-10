#!/usr/bin/env node
/**
 * Lê a folha «Exercícios» do teu Excel e acrescenta ao catalog.json os
 * exercícios que ainda lá não estão. Não altera os que já existem (a tua
 * classificação manual tem prioridade).
 *
 *   cd tools/import-excel && npm install
 *   node import-excel.mjs "/caminho/para/Gym.xlsx"
 *   node build-seed.mjs
 *
 * Regras (doc v2, secção 9):
 * - Região: Superior = UPPER, Inferior = LOWER (também aceita Core e Full body).
 * - «Grupo muscular» divide-se por " / ": o primeiro é o principal, os restantes secundários.
 * - «Leg» passa a Quadríceps (principal) e Glúteos (secundário).
 * - Equipamento pelo prefixo do nome: M = máquina, C = cabo, DB = haltere. Sem prefixo = vazio.
 * - Os nomes mantêm-se como estão no Excel.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, 'catalog.json');

const file = process.argv[2];
if (!file) {
  console.error('Uso: node import-excel.mjs <ficheiro.xlsx> [--sheet "Exercícios"] [--dry-run]');
  process.exit(1);
}
const sheetArg = process.argv.indexOf('--sheet');
const sheetName = sheetArg > -1 ? process.argv[sheetArg + 1] : 'Exercícios';
const dryRun = process.argv.includes('--dry-run');

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const REGION = { superior: 'UPPER', inferior: 'LOWER', core: 'CORE', 'full body': 'FULL_BODY' };

/** Nome no Excel (normalizado) → chaves de músculo. «Leg» expande para dois. */
const MUSCLE_ALIASES = {
  leg: { primary: ['quadriceps'], secondary: ['glutes'] },
  legs: { primary: ['quadriceps'], secondary: ['glutes'] },
  quadriceps: 'quadriceps', quads: 'quadriceps',
  gluteos: 'glutes', glutes: 'glutes', glute: 'glutes',
  isquiotibiais: 'hamstrings', hamstrings: 'hamstrings', posterior: 'hamstrings',
  adutores: 'adductors', adductors: 'adductors',
  gemeos: 'calves', calves: 'calves',
  peito: 'chest', chest: 'chest',
  costas: 'back', back: 'back',
  ombros: 'shoulders', ombro: 'shoulders', shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  antebracos: 'forearms', forearms: 'forearms',
  abdominais: 'abs', abs: 'abs', core: 'abs',
  lombar: 'lower_back',
};

const EQUIPMENT_PREFIX = [
  [/^DB\s/i, 'dumbbell'],
  [/^M\s/, 'machine'],
  [/^C\s/, 'cable'],
];

const wb = XLSX.read(readFileSync(file));
const sheet = wb.Sheets[sheetName] ?? wb.Sheets[wb.SheetNames.find((n) => norm(n) === norm(sheetName))];
if (!sheet) {
  console.error(`Folha "${sheetName}" não encontrada. Folhas: ${wb.SheetNames.join(', ')}`);
  process.exit(1);
}
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
if (!rows.length) {
  console.error('Folha vazia.');
  process.exit(1);
}

const headers = Object.keys(rows[0]);
const findCol = (...candidates) => headers.find((h) => candidates.includes(norm(h)));
const colName = findCol('exercicio', 'exercicios', 'nome', 'exercise', 'name');
const colRegion = findCol('regiao', 'region');
const colMuscle = findCol('grupo muscular', 'grupo', 'musculo', 'muscle group');
if (!colName) {
  console.error(`Não encontrei a coluna do nome. Colunas: ${headers.join(', ')}`);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const existing = new Set([...catalog.strength, ...catalog.mobility].map((e) => norm(e.name)));
const added = [];
const warnings = [];

for (const row of rows) {
  const name = String(row[colName] ?? '').trim();
  if (!name || existing.has(norm(name))) continue;

  const region = colRegion ? REGION[norm(row[colRegion])] ?? null : null;
  if (colRegion && row[colRegion] && !region) warnings.push(`${name}: região "${row[colRegion]}" desconhecida`);

  let primary = [];
  let secondary = [];
  if (colMuscle && row[colMuscle]) {
    const parts = String(row[colMuscle]).split(/\s*\/\s*/).filter(Boolean);
    parts.forEach((p, i) => {
      const alias = MUSCLE_ALIASES[norm(p)];
      if (!alias) {
        warnings.push(`${name}: músculo "${p}" desconhecido (acrescenta a MUSCLE_ALIASES)`);
        return;
      }
      if (typeof alias === 'object') {
        (i === 0 ? primary : secondary).push(...alias.primary);
        secondary.push(...alias.secondary);
      } else {
        (i === 0 ? primary : secondary).push(alias);
      }
    });
  }
  secondary = [...new Set(secondary)].filter((m) => !primary.includes(m));

  const equipment = EQUIPMENT_PREFIX.find(([re]) => re.test(name))?.[1] ?? null;
  added.push({ name, region, primary, secondary, movementType: null, equipment });
  existing.add(norm(name));
}

console.log(`${rows.length} linhas lidas, ${added.length} exercícios novos.`);
added.forEach((e) => console.log(`  + ${e.name}`));
warnings.forEach((w) => console.warn(`  ! ${w}`));

if (!dryRun && added.length) {
  catalog.strength.push(...added);
  catalog.version += 1;
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`catalog.json atualizado (versão ${catalog.version}). Corre agora: node build-seed.mjs`);
}
