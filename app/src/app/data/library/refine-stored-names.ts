import type { DbAdapter } from '../db/db-adapter';
import { ids } from '../../core/util/uuid';

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Os nomes da biblioteca passaram a inglês (o português fica em `namePt`). Aqui, os teus exercícios que ainda
 * têm o nome português da biblioteca passam ao nome inglês: o mesmo id, o mesmo histórico, só muda o nome.
 * Casa pelo id da biblioteca ou, para os que vieram de outro lado (Excel, seeds), pelo nome português exato.
 * Idempotente; não toca em nomes que mudaste à mão nem cria nomes repetidos. Usa a hora real para ganhar no sync.
 */
export async function refineStoredNames(
  db: DbAdapter,
  deviceId: string,
  nowIso: string,
  items: readonly { key: string; name: string; namePt: string | null }[],
): Promise<number> {
  const withPt = items.filter((i) => i.namePt && fold(i.namePt) !== fold(i.name));
  if (!withPt.length) return 0;
  const byId = new Map(withPt.map((i) => [ids.libraryExercise(i.key), i]));
  const byPt = new Map(withPt.map((i) => [fold(i.namePt!), i]));
  const rows = await db.query<{ id: string; name: string }>('SELECT id, name FROM exercise WHERE deleted_at IS NULL');
  const taken = new Set(rows.map((r) => fold(r.name)));
  let renamed = 0;
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const item = byId.get(r.id) ?? byPt.get(fold(r.name));
      if (!item || fold(r.name) !== fold(item.namePt!)) continue;
      if (taken.has(fold(item.name))) continue;
      await tx.run('UPDATE exercise SET name = ?, updated_at = ?, device_id = ? WHERE id = ?', [item.name, nowIso, deviceId, r.id]);
      taken.delete(fold(r.name));
      taken.add(fold(item.name));
      renamed++;
    }
  });
  return renamed;
}

/**
 * Mecânica (multi/monoarticular) para os teus exercícios que vieram da biblioteca e ainda não a têm.
 * Só lê as linhas sem mecânica, por isso em regime normal não escreve nada. Casa pelo id ou pelo nome (EN ou PT).
 */
export async function refineStoredMechanic(
  db: DbAdapter,
  deviceId: string,
  nowIso: string,
  items: readonly { key: string; name: string; namePt: string | null; kind: string; mechanic: 'COMPOUND' | 'ISOLATION' | null }[],
): Promise<number> {
  const rows = await db.query<{ id: string; name: string }>(
    "SELECT id, name FROM exercise WHERE mechanic IS NULL AND kind = 'STRENGTH' AND deleted_at IS NULL",
  );
  if (!rows.length) return 0;
  const withMech = items.filter((i) => i.kind === 'STRENGTH' && i.mechanic);
  const byId = new Map(withMech.map((i) => [ids.libraryExercise(i.key), i]));
  const byName = new Map<string, (typeof withMech)[number]>();
  for (const i of withMech) {
    byName.set(fold(i.name), i);
    if (i.namePt) byName.set(fold(i.namePt), i);
  }
  let n = 0;
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const item = byId.get(r.id) ?? byName.get(fold(r.name));
      if (!item) continue;
      await tx.run('UPDATE exercise SET mechanic = ?, updated_at = ?, device_id = ? WHERE id = ? AND mechanic IS NULL', [
        item.mechanic, nowIso, deviceId, r.id,
      ]);
      n++;
    }
  });
  return n;
}
