import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regras de arquitetura (instruções do projeto), verificadas em cada `npm run test:core`:
 * - core/      TypeScript puro: recebe dados, devolve decisões. Sem Angular, Ionic, Capacitor, Supabase nem base de dados.
 *              Pode importar core/ e os tipos de data/models.
 * - data/      base local (SQLite/sql.js), migrações, repositórios, merge, sync, seed. Sem Angular nem Ionic.
 * - services/  ligação ao Angular e aos plugins nativos.
 * Os testes (*.test.ts) podem importar o que precisarem.
 */
const APP = dirname(fileURLToPath(import.meta.url));

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const sources = (dir: string) => walk(join(APP, dir)).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

const SPEC = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(SPEC)].map((m) => m[1]);

/** Para cada import: pacote (nome) ou caminho dentro de src/app (ex.: «data/models/enums»). */
const target = (file: string, spec: string) =>
  spec.startsWith('.') ? { path: relative(APP, resolve(dirname(file), spec)) } : { pkg: spec };

const PLATFORM = /^(@angular|@ionic|@capacitor|@capacitor-community|@capgo|@supabase|rxjs|jeep-sqlite|sql\.js|ionicons)(\/|$)/;

function violations(dir: string, ok: (t: { path?: string; pkg?: string }) => boolean): string[] {
  const out: string[] = [];
  for (const f of sources(dir)) {
    for (const spec of imports(f)) {
      if (!ok(target(f, spec))) out.push(`${relative(APP, f)} → ${spec}`);
    }
  }
  return out;
}

describe('arquitetura', () => {
  it('core/ é TypeScript puro: só core/, data/models e bibliotecas puras', () => {
    const bad = violations('core', (t) =>
      t.pkg !== undefined ? !PLATFORM.test(t.pkg) && !t.pkg.startsWith('node:') : t.path!.startsWith('core/') || t.path!.startsWith('data/models/'),
    );
    expect(bad).toEqual([]);
  });

  it('core/ não fala com a base de dados', () => {
    const bad = sources('core').filter((f) => /\bDbAdapter\b|\.query\(|\.run\(\s*['"`](INSERT|UPDATE|DELETE|SELECT)/i.test(readFileSync(f, 'utf8')));
    expect(bad.map((f) => relative(APP, f))).toEqual([]);
  });

  it('data/models só tem tipos: não importa nada fora de data/models', () => {
    const bad = violations('data/models', (t) => t.path !== undefined && t.path.startsWith('data/models/'));
    expect(bad).toEqual([]);
  });

  it('data/ não depende de Angular, Ionic nem de services/ ou features/', () => {
    const bad = violations('data', (t) =>
      t.pkg !== undefined ? !/^(@angular|@ionic|ionicons)(\/|$)/.test(t.pkg) : !t.path!.startsWith('services/') && !t.path!.startsWith('features/'),
    );
    expect(bad).toEqual([]);
  });
});
