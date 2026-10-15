import { MIGRATION_001 } from './001-init';
import { MIGRATION_002 } from './002-cardio';
import { MIGRATION_003 } from './003-sync-state';
import { MIGRATION_004 } from './004-rir';
import { MIGRATION_005 } from './005-progress-photo';
import { MIGRATION_006 } from './006-recovery';
import { MIGRATION_007 } from './007-health';
import { MIGRATION_008 } from './008-category';
import { MIGRATION_009 } from './009-health-detail';
import { MIGRATION_010 } from './010-progression';
import { MIGRATION_011 } from './011-suggestion';
import { MIGRATION_012 } from './012-cycle';
import { MIGRATION_013 } from './013-cycle-schedule';

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
  { version: 7, name: '007-health', sql: MIGRATION_007 },
  { version: 8, name: '008-category', sql: MIGRATION_008 },
  { version: 9, name: '009-health-detail', sql: MIGRATION_009 },
  { version: 10, name: '010-progression', sql: MIGRATION_010 },
  { version: 11, name: '011-suggestion', sql: MIGRATION_011 },
  { version: 12, name: '012-cycle', sql: MIGRATION_012 },
  { version: 13, name: '013-cycle-schedule', sql: MIGRATION_013 },
];
