import initSqlJs, { SqlJsStatic } from 'sql.js';
import { SqlJsAdapter } from '../db/adapters/sqljs-adapter';
import { ensureDeviceId } from '../db/local-meta';
import { migrate } from '../db/migrator';
import { LEGACY_EXERCISES, SEED } from '../seed/seed.generated';
import type { SeedData } from '../seed/seed-types';

/** Seed com os 39 exercícios antigos, para testes que precisam de um catálogo. */
export const TEST_SEED: SeedData = { ...SEED, exercises: LEGACY_EXERCISES, retiredExercises: [] };

let SQL: SqlJsStatic | null = null;

/** Base em memória, já migrada. */
export async function createTestDb(): Promise<{ db: SqlJsAdapter; deviceId: string }> {
  SQL ??= await initSqlJs();
  const db = await SqlJsAdapter.create(SQL);
  await migrate(db);
  const deviceId = await ensureDeviceId(db);
  return { db, deviceId };
}

export async function createEmptyDb(): Promise<SqlJsAdapter> {
  SQL ??= await initSqlJs();
  return SqlJsAdapter.create(SQL);
}
