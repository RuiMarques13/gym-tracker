import type { DbAdapter } from '../db/db-adapter';
import { getMeta, setMeta } from '../db/local-meta';
import { EXPORT_FORMAT, EXPORT_VERSION, MERGE_TABLES, mergeData, MergeError, type MergeTable } from '../merge/merge';
import {
  SYNC_PROTOCOL_VERSION,
  SyncError,
  type SyncPullResponse,
  type SyncRow,
  type SyncTables,
  type SyncTransport,
} from './sync-types';

/** Linhas por pedido de envio. As tabelas vão por ordem de dependência, por isso um lote nunca traz filhos antes dos pais. */
const PUSH_BATCH = 1500;
const PULL_PAGE = 1000;
const MAX_PAGES = 500;

const META_CURSOR = 'sync.cursor';
const META_USER = 'sync.user_id';

export interface SyncOptions {
  deviceId: string;
  /** Utilizador autenticado. Se mudar, o estado de sync recomeça (as linhas voltam a estar «por enviar»). */
  userId: string;
  schemaVersion: number;
  nowIso: () => string;
  /** Tamanho da página do pull (testes). */
  pullPage?: number;
}

export interface SyncReport {
  pushed: number;
  pulled: number;
  /** Linhas recebidas que mudaram mesmo a base local (novas ou mais recentes). */
  changed: number;
}

/** Condição SQL: a linha local difere do que o servidor conhece. */
const DIRTY_FROM = (table: string) => `
  FROM ${table} t
  LEFT JOIN sync_row s ON s.table_name = '${table}' AND s.row_id = t.id
  WHERE (s.row_id IS NULL OR s.updated_at <> t.updated_at OR s.device_id <> t.device_id)
  ${table === 'setting' ? "AND t.scope <> 'DEVICE'" : ''}`;

/** Há alguma linha local por enviar? (consulta barata, para o sync saber se tem de repetir) */
export async function hasDirty(db: DbAdapter): Promise<boolean> {
  for (const table of MERGE_TABLES) {
    const r = await db.query(`SELECT 1 AS x ${DIRTY_FROM(table)} LIMIT 1`);
    if (r.length) return true;
  }
  return false;
}

/** Apaga o estado de sync: da próxima vez, tudo o que existe é enviado e o servidor é lido desde o início. */
export async function resetSyncState(db: DbAdapter): Promise<void> {
  await db.run('DELETE FROM sync_row');
  await db.run("DELETE FROM local_meta WHERE key = ?", [META_CURSOR]);
}

/**
 * Uma volta de sync: envia o que mudou aqui, depois traz o que mudou lá.
 * - Conflitos: última escrita ganha, por linha (a mesma regra do import, core/merge).
 * - Se falhar a meio, nada se perde: o cursor e o estado só avançam depois de cada passo ter dado certo,
 *   e repetir é seguro (idempotente).
 */
export async function syncOnce(db: DbAdapter, transport: SyncTransport, opts: SyncOptions): Promise<SyncReport> {
  await ensureUser(db, opts.userId);
  const pushed = await pushDirty(db, transport, opts);
  const { pulled, changed } = await pullAll(db, transport, opts);
  return { pushed, pulled, changed };
}

async function ensureUser(db: DbAdapter, userId: string): Promise<void> {
  const current = await getMeta(db, META_USER);
  if (current === userId) return;
  if (current !== null) await resetSyncState(db); // outra conta neste dispositivo
  await setMeta(db, META_USER, userId);
}

async function pushDirty(db: DbAdapter, transport: SyncTransport, opts: SyncOptions): Promise<number> {
  let total = 0;
  let batch: SyncTables = {};
  let inBatch = 0;
  const sent: Array<{ table: MergeTable; id: string; updated_at: string; device_id: string }> = [];

  const flush = async () => {
    if (!inBatch) return;
    const res = await transport.push({ protocol_version: SYNC_PROTOCOL_VERSION, device_id: opts.deviceId, tables: batch });
    if (res.protocol_version !== SYNC_PROTOCOL_VERSION) throw new SyncError('Versão do servidor incompatível.', 'protocol');
    // O servidor aceitou o pedido: o que enviámos passa a ser «conhecido» (mesmo se ele guardou outra versão por ser mais recente;
    // essa chega no pull e o merge decide).
    await db.transaction(async (tx) => {
      for (const r of sent) {
        await tx.run(
          `INSERT INTO sync_row (table_name, row_id, updated_at, device_id) VALUES (?, ?, ?, ?)
           ON CONFLICT(table_name, row_id) DO UPDATE SET updated_at = excluded.updated_at, device_id = excluded.device_id`,
          [r.table, r.id, r.updated_at, r.device_id],
        );
      }
    });
    total += inBatch;
    batch = {};
    inBatch = 0;
    sent.length = 0;
  };

  for (const table of MERGE_TABLES) {
    const rows = await db.query<SyncRow>(`SELECT t.* ${DIRTY_FROM(table)}`);
    for (const row of rows) {
      (batch[table] ??= []).push(row);
      sent.push({ table, id: String(row['id']), updated_at: String(row['updated_at']), device_id: String(row['device_id']) });
      if (++inBatch >= PUSH_BATCH) await flush();
    }
  }
  await flush();
  return total;
}

async function pullAll(db: DbAdapter, transport: SyncTransport, opts: SyncOptions): Promise<{ pulled: number; changed: number }> {
  const start = Number((await getMeta(db, META_CURSOR)) ?? 0) || 0;
  let cursor = start;
  const acc: SyncTables = {};
  let pulled = 0;

  // Lê todas as páginas antes de aplicar: o servidor pagina por server_version, não por dependência,
  // e um filho pode vir numa página antes do pai. Aplicando tudo numa só transação, as referências verificam-se no fim.
  for (let page = 0; page < MAX_PAGES; page++) {
    const res: SyncPullResponse = await transport.pull(cursor, opts.pullPage ?? PULL_PAGE);
    if (res.protocol_version !== SYNC_PROTOCOL_VERSION) throw new SyncError('Versão do servidor incompatível.', 'protocol');
    for (const table of MERGE_TABLES) {
      const rows = res.tables?.[table];
      if (rows?.length) {
        (acc[table] ??= []).push(...rows);
        pulled += rows.length;
      }
    }
    const advanced = res.cursor > cursor;
    cursor = Math.max(cursor, res.cursor);
    if (!res.has_more) break;
    if (!advanced) throw new SyncError('O servidor não avançou o cursor.', 'protocol');
  }

  if (pulled === 0) {
    if (cursor !== start) await setMeta(db, META_CURSOR, String(cursor));
    return { pulled: 0, changed: 0 };
  }

  let changed = 0;
  try {
    const report = await mergeData(db, {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      schemaVersion: opts.schemaVersion,
      exportedAt: opts.nowIso(),
      deviceId: 'server',
      tables: acc,
    });
    changed = report.inserted + report.updated;
  } catch (err) {
    if (err instanceof MergeError) throw new SyncError(err.message, 'data');
    throw err;
  }

  // Passa a constar o que o servidor conhece. Se a linha local tem o mesmo conteúdo (só muda o device_id, p.ex. o seed
  // criado em dois dispositivos), conta como em dia: senão ficava para sempre «por enviar» e o servidor ignorava-a.
  // Se a local é mais recente, regista-se a versão do servidor e a local continua «por enviar».
  await db.transaction(async (tx) => {
    for (const table of MERGE_TABLES) {
      for (const r of acc[table] ?? []) {
        const local = (await tx.query<SyncRow>(`SELECT * FROM ${table} WHERE id = ?`, [String(r['id'])]))[0];
        const known = local && sameContent(r, local) ? local : r;
        await tx.run(
          `INSERT INTO sync_row (table_name, row_id, updated_at, device_id) VALUES (?, ?, ?, ?)
           ON CONFLICT(table_name, row_id) DO UPDATE SET updated_at = excluded.updated_at, device_id = excluded.device_id`,
          [table, String(r['id']), String(known['updated_at']), String(known['device_id'])],
        );
      }
    }
  });
  await setMeta(db, META_CURSOR, String(cursor));
  return { pulled, changed };
}

/** Mesmo conteúdo, ignorando o device_id (e colunas que a base local não tem, como server_version). */
function sameContent(server: SyncRow, local: SyncRow): boolean {
  for (const [k, v] of Object.entries(server)) {
    if (k === 'device_id' || !(k in local)) continue;
    if ((local[k] ?? null) !== (v ?? null)) return false;
  }
  return true;
}
