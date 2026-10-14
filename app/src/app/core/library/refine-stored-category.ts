import type { DbAdapter } from '../db/db-adapter';
import { Category, defaultCategory, Kind } from '../../data/models/enums';
import { ids } from '../util/uuid';

/**
 * Exercícios que vieram da biblioteca antes de existirem categorias ficam com category NULL
 * (= a por omissão do tipo). Aqui recebem a categoria fina da biblioteca (ex.: Clean → Potência).
 * Idempotente: só toca em linhas com category NULL, não mexe em exercícios que já escolheste,
 * e usa a hora real para ganhar no sync.
 */
export async function refineStoredCategories(
  db: DbAdapter,
  deviceId: string,
  nowIso: string,
  items: readonly { key: string; kind: Kind; category: Category }[],
): Promise<void> {
  // Só olha para as linhas que ainda não têm categoria: com 1100+ itens na biblioteca, um UPDATE por item
  // em cada arranque custaria centenas de chamadas à base de dados no telemóvel.
  const pending = new Set(
    (await db.query<{ id: string }>('SELECT id FROM exercise WHERE category IS NULL AND deleted_at IS NULL')).map((r) => r.id),
  );
  const fine = items.filter((i) => i.category !== defaultCategory(i.kind) && pending.has(ids.libraryExercise(i.key)));
  if (!fine.length) return;
  await db.transaction(async (tx) => {
    for (const i of fine) {
      await tx.run(
        `UPDATE exercise SET category = ?, updated_at = ?, device_id = ?
          WHERE id = ? AND kind = ? AND category IS NULL AND deleted_at IS NULL`,
        [i.category, nowIso, deviceId, ids.libraryExercise(i.key), i.kind],
      );
    }
  });
}
