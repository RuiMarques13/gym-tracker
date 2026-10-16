import type { DbAdapter } from '../db/db-adapter';
import { ids } from '../../core/util/uuid';
import { LEGACY_MUSCLES, refineMuscles } from '../../core/library/muscle-refine';

/**
 * Converte, nas bases existentes, os músculos antigos (costas, ombros, trapézio) nos finos
 * (dorsais, costas superiores, deltoides…). Idempotente: só mexe em exercícios que ainda tenham
 * chaves antigas, usa IDs deterministas e a hora real (para ganhar no sync). No fim, retira os
 * grupos antigos que já ninguém usa, para saírem dos seletores.
 */
export async function refineStoredMuscles(db: DbAdapter, deviceId: string, nowIso: string): Promise<number> {
  const legacyIds = LEGACY_MUSCLES.map((k) => ids.muscle(k));
  const marks = legacyIds.map(() => '?').join(',');
  const affected = await db.query<{ id: string; name: string }>(
    `SELECT DISTINCT e.id, e.name FROM exercise e
       JOIN exercise_muscle em ON em.exercise_id = e.id AND em.deleted_at IS NULL
      WHERE e.deleted_at IS NULL AND em.muscle_group_id IN (${marks})`,
    legacyIds,
  );
  const keyById = new Map<string, string>();
  if (!affected.length) {
    await retireUnusedLegacy(db, legacyIds, deviceId, nowIso);
    return 0;
  }
  // chave <- id (os IDs vêm de UUID v5 das chaves, por isso calcula-se o inverso a partir das chaves conhecidas)
  for (const k of [
    'back', 'shoulders', 'traps', 'quadriceps', 'glutes', 'hamstrings', 'adductors', 'calves', 'chest', 'biceps',
    'triceps', 'forearms', 'abs', 'lower_back', 'abductors', 'tibialis', 'obliques', 'neck',
    'lats', 'upper_back', 'front_delt', 'side_delt', 'rear_delt',
  ]) keyById.set(ids.muscle(k), k);

  await db.transaction(async (tx) => {
    for (const ex of affected) {
      const cur = await tx.query<{ id: string; muscle_group_id: string; is_primary: number }>(
        'SELECT id, muscle_group_id, is_primary FROM exercise_muscle WHERE exercise_id = ? AND deleted_at IS NULL',
        [ex.id],
      );
      const keys = (primary: number) =>
        cur.filter((r) => r.is_primary === primary).map((r) => keyById.get(r.muscle_group_id)).filter((k): k is string => !!k);
      const refined = refineMuscles(ex.name, { primary: keys(1), secondary: keys(0) });
      // Músculos desconhecidos (criados por ti) mantêm-se tal como estão.
      const unknown = cur.filter((r) => !keyById.has(r.muscle_group_id));
      const wanted = new Map<string, number>();
      for (const k of refined.secondary) wanted.set(ids.muscle(k), 0);
      for (const k of refined.primary) wanted.set(ids.muscle(k), 1);
      for (const u of unknown) wanted.set(u.muscle_group_id, u.is_primary);
      for (const r of cur) {
        if (!wanted.has(r.muscle_group_id)) {
          await tx.run('UPDATE exercise_muscle SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
            nowIso, nowIso, deviceId, r.id,
          ]);
        }
      }
      for (const [muscleId, isPrimary] of wanted) {
        await tx.run(
          `INSERT INTO exercise_muscle (id, exercise_id, muscle_group_id, is_primary, updated_at, deleted_at, device_id)
           VALUES (?, ?, ?, ?, ?, NULL, ?)
           ON CONFLICT(id) DO UPDATE SET is_primary = excluded.is_primary, deleted_at = NULL,
             updated_at = excluded.updated_at, device_id = excluded.device_id
           WHERE exercise_muscle.deleted_at IS NOT NULL OR exercise_muscle.is_primary <> excluded.is_primary`,
          [ids.exerciseMuscle(ex.id, muscleId), ex.id, muscleId, isPrimary, nowIso, deviceId],
        );
      }
    }
  });
  await retireUnusedLegacy(db, legacyIds, deviceId, nowIso);
  return affected.length;
}

async function retireUnusedLegacy(db: DbAdapter, legacyIds: string[], deviceId: string, nowIso: string): Promise<void> {
  for (const id of legacyIds) {
    await db.run(
      `UPDATE muscle_group SET deleted_at = ?, updated_at = ?, device_id = ?
        WHERE id = ? AND deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM exercise_muscle WHERE muscle_group_id = ? AND deleted_at IS NULL)`,
      [nowIso, nowIso, deviceId, id, id],
    );
  }
}

/** Hip thrust e variantes são movimento de empurrar (extensão da anca): corrige as bases onde ficou «puxar». */
export async function fixStoredMovement(db: DbAdapter, deviceId: string, nowIso: string): Promise<void> {
  await db.run(
    `UPDATE exercise SET movement_type = 'PUSH', updated_at = ?, device_id = ?
      WHERE deleted_at IS NULL AND movement_type = 'PULL' AND lower(name) LIKE '%hip thrust%'`,
    [nowIso, deviceId],
  );
}
