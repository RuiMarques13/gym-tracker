import { MIGRATION_001 } from './001-init';
import { MIGRATION_002 } from './002-cardio';
import { MIGRATION_003 } from './003-sync-state';
import { MIGRATION_004 } from './004-rir';
import { MIGRATION_005 } from './005-progress-photo';
import { MIGRATION_006 } from './006-recovery';

export interface Migration {
  version: number;
  name: string;
  sql: string;
  /**
   * Reconstrução de tabelas referenciadas por chaves estrangeiras: o migrator desliga-as
   * antes da transação, corre PRAGMA foreign_key_check no fim e volta a ligá-las.
   */
  disableForeignKeys?: boolean;
}

/**
 * Lista ordenada de migrações. Regras:
 * - Nunca editar uma migração já publicada; criar a seguinte (003-..., 004-...).
 * - Cada migração corre numa transação; se falhar, a base fica como estava.
 */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: '001-init', sql: MIGRATION_001 },
  { version: 2, name: '002-cardio', sql: MIGRATION_002, disableForeignKeys: true },
  { version: 3, name: '003-sync-state', sql: MIGRATION_003 },
  { version: 4, name: '004-rir', sql: MIGRATION_004 },
  { version: 5, name: '005-progress-photo', sql: MIGRATION_005 },
  { version: 6, name: '006-recovery', sql: MIGRATION_006 },
];
