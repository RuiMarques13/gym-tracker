import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Postgres real (PGlite) com as migrações de supabase/migrations: serve de servidor nos testes. */
const MIGRATION_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../supabase/migrations');

export async function freshServer(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;`);
  for (const f of readdirSync(MIGRATION_DIR).filter((n) => n.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(MIGRATION_DIR, f), 'utf8'));
  }
  return pg;
}

/** Corre fn como o papel `authenticated` com o JWT de `user` (ou sem utilizador). */
export async function asUser<T>(pg: PGlite, user: string | null, fn: () => Promise<T>): Promise<T> {
  await pg.exec(`SET ROLE authenticated`);
  await pg.query(`SELECT set_config('request.jwt.claims', $1, false)`, [user ? JSON.stringify({ sub: user }) : '']);
  try {
    return await fn();
  } finally {
    await pg.exec(`RESET ROLE`);
  }
}
