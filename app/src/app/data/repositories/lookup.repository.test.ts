import { describe, expect, it } from 'vitest';
import { SEED } from '../../core/seed/seed.generated';
import { loadSeed } from '../../core/seed/seed-loader';
import { createTestDb } from '../../core/testing/test-db';
import { SqliteLookupRepository } from './lookup.repository';

describe('SqliteLookupRepository', () => {
  it('lista músculos por região e equipamentos/áreas por nome', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, SEED, deviceId);
    const repo = new SqliteLookupRepository(db);
    const muscles = await repo.muscles();
    expect(muscles).toHaveLength(SEED.muscles.length);
    expect(muscles[0].region).toBe('UPPER');
    expect(muscles.at(-1)?.region).toBe('CORE');
    const equipment = (await repo.equipment()).map((e) => e.name);
    expect(equipment).toContain('Passadeira');
    expect((await repo.mobilityAreas()).map((a) => a.name)[0]).toBe('Anca');
  });
});
