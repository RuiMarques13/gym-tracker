import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/test-db';
import { ids } from '../util/uuid';
import { refineStoredNames } from './refine-stored-names';

const NOW = '2026-10-14T22:00:00.000Z';
const ITEMS = [
  { key: 'supino-plano--barbell', name: 'Barbell Bench Press', namePt: 'Supino plano (barra)' },
  { key: 'gato-camelo--none', name: 'Cat-Cow', namePt: 'Gato-camelo' },
  { key: 'pullups--fedb', name: 'Pullups', namePt: null },
];

async function insert(db: Awaited<ReturnType<typeof createTestDb>>['db'], id: string, name: string) {
  await db.run(
    `INSERT INTO exercise (id, name, kind, metric_type, is_unilateral, is_isometric, updated_at, device_id)
     VALUES (?, ?, 'STRENGTH', 'WEIGHT_REPS', 0, 0, '2026-01-01T00:00:00.000Z', 'x')`,
    [id, name],
  );
}
const nameOf = async (db: Awaited<ReturnType<typeof createTestDb>>['db'], id: string) =>
  (await db.query<{ name: string; updated_at: string }>('SELECT name, updated_at FROM exercise WHERE id = ?', [id]))[0];

describe('refineStoredNames', () => {
  it('passa ao inglês os nomes portugueses da biblioteca, pelo id ou pelo nome, e não mexe nos teus', async () => {
    const { db, deviceId } = await createTestDb();
    const fromLibrary = ids.libraryExercise('supino-plano--barbell');
    await insert(db, fromLibrary, 'Supino plano (barra)');
    await insert(db, 'excel-1', 'gato-camelo'); // veio do Excel, mesmo nome (sem maiúsculas)
    await insert(db, 'mine-1', 'O meu supino'); // nome teu
    expect(await refineStoredNames(db, deviceId, NOW, ITEMS)).toBe(2);
    expect(await nameOf(db, fromLibrary)).toEqual({ name: 'Barbell Bench Press', updated_at: NOW });
    expect((await nameOf(db, 'excel-1')).name).toBe('Cat-Cow');
    expect((await nameOf(db, 'mine-1')).name).toBe('O meu supino');
    expect(await refineStoredNames(db, deviceId, NOW, ITEMS)).toBe(0);
  });

  it('não cria nomes repetidos', async () => {
    const { db, deviceId } = await createTestDb();
    await insert(db, 'a', 'Supino plano (barra)');
    await insert(db, 'b', 'Barbell Bench Press');
    expect(await refineStoredNames(db, deviceId, NOW, ITEMS)).toBe(0);
    expect((await nameOf(db, 'a')).name).toBe('Supino plano (barra)');
  });
});
