import { describe, expect, it } from 'vitest';
import { createTestDb, TEST_SEED } from '../testing/test-db';
import { loadSeed } from '../seed/seed-loader';
import { ids } from '../../core/util/uuid';
import { refineStoredMuscles } from './refine-stored-muscles';

const NOW = '2026-10-10T10:00:00.000Z';

async function muscles(db: Awaited<ReturnType<typeof createTestDb>>['db'], exId: string) {
  return db.query<{ muscle_group_id: string; is_primary: number }>(
    'SELECT muscle_group_id, is_primary FROM exercise_muscle WHERE exercise_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, muscle_group_id',
    [exId],
  );
}

describe('refineStoredMuscles', () => {
  it('converte costas/ombros nos músculos finos e retira os grupos antigos sem uso', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, TEST_SEED, deviceId); // exercícios antigos com «back»
    const row = (await db.query<{ id: string; name: string }>(
      `SELECT e.id, e.name FROM exercise e JOIN exercise_muscle em ON em.exercise_id = e.id
        WHERE em.muscle_group_id = ? AND em.is_primary = 1 LIMIT 1`, [ids.muscle('back')]))[0];
    expect(row).toBeTruthy();
    const n = await refineStoredMuscles(db, deviceId, NOW);
    expect(n).toBeGreaterThan(0);
    const after = await muscles(db, row.id);
    expect(after.some((m) => m.muscle_group_id === ids.muscle('back'))).toBe(false);
    expect(after.some((m) => m.muscle_group_id === ids.muscle('lats') && m.is_primary === 1)).toBe(true);
    const legacy = await db.query<{ deleted_at: string | null }>('SELECT deleted_at FROM muscle_group WHERE id = ?', [ids.muscle('back')]);
    expect(legacy[0].deleted_at).toBe(NOW);
    // idempotente
    expect(await refineStoredMuscles(db, deviceId, NOW)).toBe(0);
  });
});
