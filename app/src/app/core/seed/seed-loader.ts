import { DbAdapter } from '../db/db-adapter';
import { getMeta } from '../db/local-meta';
import { ids } from '../util/uuid';
import { SeedData } from './seed-types';

/**
 * updated_at fixo para linhas de seed. Assim, qualquer edição tua
 * (com updated_at real) ganha sempre no last-write-wins, mesmo que
 * outro dispositivo faça o seed mais tarde.
 */
export const SEED_UPDATED_AT = '2000-01-01T00:00:00.000Z';

export interface SeedResult {
  skipped: boolean;
  version: number;
}

/**
 * Carrega o seed se a versão guardada for inferior à do seed.
 * Idempotente: ON CONFLICT(id) DO NOTHING nunca sobrepõe edições,
 * arquivos ou apagados teus.
 */
export async function loadSeed(db: DbAdapter, seed: SeedData, deviceId: string): Promise<SeedResult> {
  const current = Number((await getMeta(db, 'seed_version')) ?? 0);
  if (current >= seed.version) return { skipped: true, version: current };

  await db.transaction(async (tx) => {
    const sync = [SEED_UPDATED_AT, deviceId];
    const insert = (table: string, cols: string[], values: unknown[]) =>
      tx.run(
        `INSERT INTO ${table} (${cols.join(', ')}, updated_at, device_id)
         VALUES (${cols.map(() => '?').join(', ')}, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [...(values as (string | number | null)[]), ...sync],
      );

    for (const e of seed.equipment) {
      await insert('equipment', ['id', 'name'], [ids.equipment(e.key), e.name]);
    }
    for (const m of seed.muscles) {
      await insert('muscle_group', ['id', 'name', 'region'], [ids.muscle(m.key), m.name, m.region]);
    }
    for (const a of seed.mobilityAreas) {
      await insert('mobility_area', ['id', 'name'], [ids.mobilityArea(a.key), a.name]);
    }

    for (const ex of seed.exercises) {
      const exId = ids.exercise(ex.name);
      await insert(
        'exercise',
        [
          'id', 'name', 'kind', 'metric_type', 'is_unilateral', 'region', 'movement_type',
          'is_isometric', 'equipment_id', 'default_rest_seconds',
        ],
        [
          exId, ex.name, ex.kind, ex.metricType, ex.isUnilateral ? 1 : 0, ex.region, ex.movementType,
          ex.isIsometric ? 1 : 0, ex.equipment ? ids.equipment(ex.equipment) : null, ex.defaultRestSeconds,
        ],
      );
      const muscles = [
        ...ex.primary.map((k) => ({ k, primary: 1 })),
        ...ex.secondary.map((k) => ({ k, primary: 0 })),
      ];
      for (const { k, primary } of muscles) {
        const muscleId = ids.muscle(k);
        await insert(
          'exercise_muscle',
          ['id', 'exercise_id', 'muscle_group_id', 'is_primary'],
          [ids.exerciseMuscle(exId, muscleId), exId, muscleId, primary],
        );
      }
      for (const k of ex.mobilityAreas) {
        const areaId = ids.mobilityArea(k);
        await insert(
          'exercise_mobility_area',
          ['id', 'exercise_id', 'mobility_area_id'],
          [ids.exerciseMobilityArea(exId, areaId), exId, areaId],
        );
      }
    }
    await tx.run(
      'INSERT INTO local_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['seed_version', String(seed.version)],
    );
  });

  return { skipped: false, version: seed.version };
}
