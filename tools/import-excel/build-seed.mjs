#!/usr/bin/env node
/**
 * Gera app/src/app/core/seed/seed.generated.ts a partir de catalog.json.
 *
 *   node tools/import-excel/build-seed.mjs
 *
 * catalog.json é a fonte de verdade editável. O ficheiro gerado só tem
 * chaves e nomes; os IDs (UUID v5) calculam-se na app.
 * Ao acrescentar exercícios, sobe "version" em catalog.json para a app
 * voltar a correr o seed (só insere linhas novas, nunca sobrepõe).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, 'catalog.json');
const outPath = resolve(here, '../../app/src/app/core/seed/seed.generated.ts');

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const REGIONS = new Set(['UPPER', 'LOWER', 'CORE', 'FULL_BODY']);
const METRICS = new Set(['WEIGHT_REPS', 'REPS', 'DURATION']);
const MOVES = new Set(['PUSH', 'PULL']);

const errors = [];
const muscleKeys = new Set(catalog.muscles.map((m) => m.key));
const equipmentKeys = new Set(catalog.equipment.map((e) => e.key));
const areaKeys = new Set(catalog.mobilityAreas.map((a) => a.key));
const names = new Set();

function checkName(name) {
  const k = name.trim().toLowerCase();
  if (names.has(k)) errors.push(`Nome repetido: ${name}`);
  names.add(k);
}

const exercises = [];

for (const s of catalog.strength) {
  checkName(s.name);
  if (s.region && !REGIONS.has(s.region)) errors.push(`${s.name}: região inválida ${s.region}`);
  if (s.movementType && !MOVES.has(s.movementType)) errors.push(`${s.name}: tipo inválido ${s.movementType}`);
  const metric = s.metricType ?? 'WEIGHT_REPS';
  if (!METRICS.has(metric)) errors.push(`${s.name}: medida inválida ${metric}`);
  for (const m of [...(s.primary ?? []), ...(s.secondary ?? [])]) {
    if (!muscleKeys.has(m)) errors.push(`${s.name}: músculo desconhecido ${m}`);
  }
  if (s.equipment && !equipmentKeys.has(s.equipment)) errors.push(`${s.name}: equipamento desconhecido ${s.equipment}`);
  exercises.push({
    name: s.name.trim(),
    kind: 'STRENGTH',
    metricType: metric,
    isUnilateral: !!s.isUnilateral,
    isIsometric: !!s.isIsometric,
    region: s.region ?? null,
    movementType: s.movementType ?? null,
    equipment: s.equipment ?? null,
    defaultRestSeconds: s.defaultRestSeconds ?? null,
    primary: s.primary ?? [],
    secondary: s.secondary ?? [],
    mobilityAreas: [],
  });
}

for (const m of catalog.mobility) {
  checkName(m.name);
  if (m.metricType === 'WEIGHT_REPS' || !METRICS.has(m.metricType)) {
    errors.push(`${m.name}: medida inválida para mobilidade ${m.metricType}`);
  }
  for (const a of m.areas ?? []) if (!areaKeys.has(a)) errors.push(`${m.name}: área desconhecida ${a}`);
  if (m.equipment && !equipmentKeys.has(m.equipment)) errors.push(`${m.name}: equipamento desconhecido ${m.equipment}`);
  exercises.push({
    name: m.name.trim(),
    kind: 'MOBILITY',
    metricType: m.metricType,
    isUnilateral: !!m.isUnilateral,
    isIsometric: !!m.isIsometric,
    region: m.region ?? null,
    movementType: null,
    equipment: m.equipment ?? null,
    defaultRestSeconds: m.defaultRestSeconds ?? null,
    primary: [],
    secondary: [],
    mobilityAreas: m.areas ?? [],
  });
}

if (errors.length) {
  console.error('Catálogo inválido:\n- ' + errors.join('\n- '));
  process.exit(1);
}

// Desde o seed v4 a app não cria exercícios: os teus vêm da biblioteca ou do formulário.
// Os 39 exercícios de origem (strength + mobility em catalog.json) ficam só como:
// - retiredExercises: apagados das bases que os receberam (seeds v1–v3);
// - LEGACY_EXERCISES: dados de teste.
// A lista de mobilidade continua a alimentar a biblioteca (grupo «Mobilidade»).
const seed = {
  version: catalog.version,
  equipment: catalog.equipment,
  muscles: catalog.muscles,
  mobilityAreas: catalog.mobilityAreas,
  exercises: [],
  retiredExercises: exercises.map((e) => e.name),
};

const out = `// GERADO por tools/import-excel/build-seed.mjs a partir de catalog.json. Não editar à mão.
import { SeedData, SeedExercise } from './seed-types';

export const SEED: SeedData = ${JSON.stringify(seed, null, 2)};

/** Os 39 exercícios dos seeds v1–v3. Só para testes e para saber o que retirar. */
export const LEGACY_EXERCISES: SeedExercise[] = ${JSON.stringify(exercises, null, 2)};
`;
writeFileSync(outPath, out);
console.log(`Seed v${seed.version}: 0 exercícios criados, ${exercises.length} a retirar de bases antigas → ${outPath}`);
