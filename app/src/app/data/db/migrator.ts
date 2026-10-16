import { DbAdapter } from './db-adapter';
import { Migration, MIGRATIONS } from './migrations';

export interface MigrationResult {
  from: number;
  to: number;
  applied: string[];
}

export async function currentSchemaVersion(db: DbAdapter): Promise<number> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`);
  const rows = await db.query<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_migrations');
  return rows[0]?.v ?? 0;
}

/** Aplica as migrações pendentes, cada uma na sua transação. */
export async function migrate(
  db: DbAdapter,
  migrations: Migration[] = MIGRATIONS,
  nowIso: () => string = () => new Date().toISOString(),
): Promise<MigrationResult> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  sorted.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Migrações fora de sequência: esperava ${i + 1}, veio ${m.version}`);
  });

  const from = await currentSchemaVersion(db);
  const applied: string[] = [];
  for (const m of sorted.filter((m) => m.version > from)) {
    await db.transaction(
      async (tx) => {
        await tx.exec(m.sql);
        await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
          m.version,
          m.name,
          nowIso(),
        ]);
      },
      { foreignKeysOff: m.disableForeignKeys },
    );
    applied.push(m.name);
  }
  return { from, to: sorted.at(-1)?.version ?? 0, applied };
}
