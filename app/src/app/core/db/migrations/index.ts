import { MIGRATION_001 } from './001-init';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Lista ordenada de migrações. Regras:
 * - Nunca editar uma migração já publicada; criar a seguinte (002-..., 003-...).
 * - Cada migração corre numa transação; se falhar, a base fica como estava.
 */
export const MIGRATIONS: Migration[] = [{ version: 1, name: '001-init', sql: MIGRATION_001 }];
