import { newId } from '../util/uuid';
import { DbAdapter } from './db-adapter';

/** Pares chave/valor só deste dispositivo (nunca sincronizam). */
export async function getMeta(db: DbAdapter, key: string): Promise<string | null> {
  const rows = await db.query<{ value: string }>('SELECT value FROM local_meta WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
}

export async function setMeta(db: DbAdapter, key: string, value: string): Promise<void> {
  await db.run(
    'INSERT INTO local_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

/** device_id criado uma vez por instalação e guardado na própria base. */
export async function ensureDeviceId(db: DbAdapter): Promise<string> {
  const existing = await getMeta(db, 'device_id');
  if (existing) return existing;
  const id = newId();
  await setMeta(db, 'device_id', id);
  return id;
}
