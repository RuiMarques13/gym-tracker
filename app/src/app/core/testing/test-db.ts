import initSqlJs, { SqlJsStatic } from 'sql.js';
import { SqlJsAdapter } from '../db/adapters/sqljs-adapter';
import { ensureDeviceId } from '../db/local-meta';
import { migrate } from '../db/migrator';

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
