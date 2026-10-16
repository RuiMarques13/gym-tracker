import { beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORIES_BY_KIND, defaultCategory, KIND_OF_CATEGORY, resolveCategory } from '../../models/enums';
import { LIBRARY } from '../../../core/library/library-data';
import { libraryItemToInput } from '../../../core/library/library';
import { refineStoredCategories } from '../../library/refine-stored-category';
import { loadSeed } from '../../seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { ids } from '../../../core/util/uuid';
import { ExerciseValidationError } from '../../models/exercise';
import { SqliteExerciseRepository } from './sqlite-exercise.repository';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
let db: Db;
let deviceId: string;
let repo: SqliteExerciseRepository;

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  deviceId = t.deviceId;
  await loadSeed(db, TEST_SEED, t.deviceId);
  repo = new SqliteExerciseRepository(db, new FixedClock(new Date('2026-10-10T08:00:00.000Z')), t.deviceId);
});

const lib = (name: string) => {
  const i = LIBRARY.items.find((x) => x.name === name || x.namePt === name);
  if (!i) throw new Error(name);
  return i;
};

describe('categorias: modelo', () => {
  it('cada categoria pertence a um tipo e a lista por tipo é consistente', () => {
    for (const c of CATEGORIES) expect(CATEGORIES_BY_KIND[KIND_OF_CATEGORY[c]]).toContain(c);
    for (const [k, cs] of Object.entries(CATEGORIES_BY_KIND)) for (const c of cs) expect(KIND_OF_CATEGORY[c]).toBe(k);
  });

  it('resolveCategory usa a por omissão quando está vazia ou não corresponde ao tipo', () => {
    expect(resolveCategory('STRENGTH', null)).toBe('STRENGTH');
    expect(resolveCategory('STRENGTH', 'POWER')).toBe('POWER');
    expect(resolveCategory('STRENGTH', 'HIIT')).toBe(defaultCategory('STRENGTH'));
    expect(resolveCategory('MOBILITY', 'lixo')).toBe('MOBILITY');
  });

  it('a biblioteca tem a categoria certa em todos os itens e usa as 8', () => {
    for (const i of LIBRARY.items) expect(KIND_OF_CATEGORY[i.category], i.name).toBe(i.kind);
    expect(new Set(LIBRARY.items.map((i) => i.category))).toEqual(new Set(CATEGORIES));
    expect(lib('Power clean').category).toBe('POWER');
    expect(lib('Burpees').category).toBe('POWER');
    expect(lib('Passadeira: sprints').category).toBe('HIIT');
    expect(lib('Passadeira: corrida contínua').category).toBe('CARDIO');
    expect(lib('Alongamento de isquiotibiais').category).toBe('FLEXIBILITY');
    expect(lib('Equilíbrio num pé').category).toBe('BALANCE');
    expect(lib('Cão a olhar para baixo (yoga)').category).toBe('MINDBODY');
    expect(lib('Supino plano (barra)').category).toBe('STRENGTH');
  });
});

describe('categorias: repositório', () => {
  it('sem categoria usa a por omissão do tipo; com categoria guarda-a e filtra', async () => {
    const a = await repo.save({ name: 'Agachamento teste', kind: 'STRENGTH', metricType: 'WEIGHT_REPS' });
    const b = await repo.save({ name: 'Salto teste', kind: 'STRENGTH', category: 'POWER', metricType: 'REPS' });
    const c = await repo.save({ name: 'Yoga teste', kind: 'MOBILITY', category: 'MINDBODY', metricType: 'DURATION' });
    const d = await repo.save({ name: 'Tiros teste', kind: 'CARDIO', category: 'HIIT', metricType: 'DURATION' });
    expect([a.category, b.category, c.category, d.category]).toEqual(['STRENGTH', 'POWER', 'MINDBODY', 'HIIT']);

    const names = async (category: Parameters<typeof repo.list>[0] extends infer F ? (F extends { category?: infer C } ? C : never) : never) =>
      (await repo.list({ category })).map((e) => e.name).filter((n) => n.endsWith('teste'));
    expect(await names('POWER')).toEqual(['Salto teste']);
    expect(await names('STRENGTH')).toEqual(['Agachamento teste']);
    expect(await names('MINDBODY')).toEqual(['Yoga teste']);
    expect(await names('HIIT')).toEqual(['Tiros teste']);
  });

  it('linhas antigas (category NULL) aparecem na categoria por omissão do tipo', async () => {
    const e = await repo.save({ name: 'Antigo', kind: 'CARDIO', metricType: 'DURATION' });
    await db.run('UPDATE exercise SET category = NULL WHERE id = ?', [e.id]);
    expect((await repo.get(e.id))!.category).toBe('CARDIO');
    expect((await repo.list({ category: 'CARDIO' })).map((x) => x.id)).toContain(e.id);
    expect((await repo.list({ category: 'HIIT' })).map((x) => x.id)).not.toContain(e.id);
  });

  it('recusa uma categoria que não pertence ao tipo', async () => {
    await expect(repo.save({ name: 'X', kind: 'STRENGTH', category: 'HIIT', metricType: 'REPS' })).rejects.toBeInstanceOf(
      ExerciseValidationError,
    );
  });

  it('a biblioteca traz a categoria ao adicionar', async () => {
    const ex = await repo.save(libraryItemToInput(lib('Power clean')));
    expect(ex).toMatchObject({ kind: 'STRENGTH', category: 'POWER' });
  });
});

describe('categorias: exercícios já adicionados', () => {
  it('refineStoredCategories dá a categoria fina da biblioteca, sem mexer no que já escolheste', async () => {
    const clean = await repo.save(libraryItemToInput(lib('Power clean')));
    const burp = await repo.save(libraryItemToInput(lib('Burpees')));
    await db.run('UPDATE exercise SET category = NULL WHERE id IN (?, ?)', [clean.id, burp.id]);
    await db.run("UPDATE exercise SET category = 'STRENGTH' WHERE id = ?", [burp.id]); // escolha tua

    await refineStoredCategories(db, deviceId, '2026-10-11T00:00:00.000Z', LIBRARY.items);
    expect((await repo.get(clean.id))!.category).toBe('POWER');
    expect((await repo.get(burp.id))!.category).toBe('STRENGTH');
    const row = (await db.query<{ updated_at: string }>('SELECT updated_at FROM exercise WHERE id = ?', [clean.id]))[0];
    expect(row.updated_at).toBe('2026-10-11T00:00:00.000Z');

    // idempotente: segunda corrida não volta a mexer
    await refineStoredCategories(db, deviceId, '2026-10-12T00:00:00.000Z', LIBRARY.items);
    expect((await db.query<{ updated_at: string }>('SELECT updated_at FROM exercise WHERE id = ?', [clean.id]))[0].updated_at)
      .toBe('2026-10-11T00:00:00.000Z');
    expect(ids.libraryExercise(lib('Power clean').key)).toBe(clean.id);
  });
});
