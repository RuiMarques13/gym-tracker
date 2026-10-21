import type { DbAdapter, SqlValue } from '../db/db-adapter';

/**
 * Exportar e importar dados com merge «última escrita ganha» (LWW) por linha.
 * É a mesma regra que o sync da Fase 3 vai usar: por isso vive em core/merge e só conhece o DbAdapter.
 *
 * Regra: a linha com maior (updated_at, device_id) ganha. Apagar é só deleted_at preenchido,
 * por isso uma remoção mais recente também ganha. Importar o mesmo ficheiro duas vezes não muda nada.
 */

/** Tabelas que viajam no ficheiro, por ordem de dependência (pais antes de filhos). */
export const MERGE_TABLES = [
  'equipment',
  'muscle_group',
  'mobility_area',
  'exercise',
  'exercise_muscle',
  'exercise_mobility_area',
  'workout_template',
  'planned_exercise',
  'scheduled_workout',
  'session',
  'session_exercise',
  'set_log',
  'setting',
  'body_metric',
  'progress_photo',
  'muscle_recovery',
  'suggestion',
  'training_cycle',
  'exercise_group',
] as const;
export type MergeTable = (typeof MERGE_TABLES)[number];

export const EXPORT_FORMAT = 'gym-tracker-export';
export const EXPORT_VERSION = 1;

type Row = Record<string, SqlValue>;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  /** Versão do esquema da base de onde veio. */
  schemaVersion: number;
  exportedAt: string;
  deviceId: string;
  tables: Partial<Record<MergeTable, Row[]>>;
}

export interface TableReport {
  inserted: number;
  updated: number;
  /** Ficam como estão: a versão local é igual ou mais recente. */
  skipped: number;
}
export interface MergeReport {
  tables: Partial<Record<MergeTable, TableReport>>;
  inserted: number;
  updated: number;
  skipped: number;
}

export class MergeError extends Error {
  constructor(
    readonly code: 'format' | 'newer-schema' | 'newer-format' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'MergeError';
  }
}

/** Linhas a levar: a tabela toda, menos as definições deste dispositivo. */
function exportSql(table: MergeTable): string {
  return table === 'setting' ? `SELECT * FROM setting WHERE scope <> 'DEVICE'` : `SELECT * FROM ${table}`;
}

/**
 * Exporta a base. `includePhotos: false` deixa as fotos de progresso de fora (dados de saúde: só saem se quiseres).
 * Um ficheiro sem fotos importa-se normalmente: o merge não apaga linhas que o ficheiro não traz.
 */
export async function exportData(
  db: DbAdapter,
  meta: { schemaVersion: number; deviceId: string; nowIso: string; includePhotos?: boolean },
): Promise<ExportFile> {
  const tables: ExportFile['tables'] = {};
  for (const t of MERGE_TABLES) {
    if (t === 'progress_photo' && meta.includePhotos === false) continue;
    tables[t] = await db.query<Row>(exportSql(t));
  }
  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, schemaVersion: meta.schemaVersion,
    exportedAt: meta.nowIso, deviceId: meta.deviceId, tables,
  };
}

/** Lê e valida o texto de um ficheiro de exportação. Não toca na base. */
export function parseExport(text: string, localSchemaVersion: number): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MergeError('format', 'Este ficheiro não é um JSON válido.');
  }
  const f = data as Partial<ExportFile> | null;
  if (!f || typeof f !== 'object' || f.format !== EXPORT_FORMAT || typeof f.tables !== 'object' || f.tables === null) {
    throw new MergeError('format', 'Este ficheiro não é uma exportação do Gym Tracker.');
  }
  if (typeof f.version !== 'number' || f.version > EXPORT_VERSION) {
    throw new MergeError('newer-format', 'Este ficheiro vem de uma versão mais recente da app. Atualiza a app e tenta outra vez.');
  }
  if (typeof f.schemaVersion !== 'number' || f.schemaVersion > localSchemaVersion) {
    throw new MergeError('newer-schema', 'Este ficheiro vem de uma versão mais recente da app. Atualiza a app e tenta outra vez.');
  }
  for (const t of MERGE_TABLES) {
    const rows = (f.tables as Record<string, unknown>)[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new MergeError('invalid', `Tabela «${t}» inválida no ficheiro.`);
    for (const r of rows) {
      const row = r as Row;
      if (!row || typeof row !== 'object' || typeof row['id'] !== 'string' || typeof row['updated_at'] !== 'string' || typeof row['device_id'] !== 'string') {
        throw new MergeError('invalid', `Linha inválida em «${t}».`);
      }
    }
  }
  return f as ExportFile;
}

/** true se a versão que chega vence a local (maior updated_at; empate desfaz-se por device_id). */
export function incomingWins(incoming: { updated_at: string; device_id: string }, local: { updated_at: string; device_id: string }): boolean {
  if (incoming.updated_at !== local.updated_at) return incoming.updated_at > local.updated_at;
  return incoming.device_id > local.device_id;
}

/**
 * Decide se a linha que chega substitui a local. Empate no updated_at com o mesmo conteúdo
 * (por exemplo, as linhas do seed, iguais em todos os dispositivos) não é alteração: fica como está.
 */
function shouldApply(incoming: Row, local: Row, localColumns: Set<string>): boolean {
  const i = incoming as { updated_at: string; device_id: string };
  const l = local as { updated_at: string; device_id: string };
  if (i.updated_at !== l.updated_at) return i.updated_at > l.updated_at;
  const same = Object.keys(incoming).every((c) => c === 'device_id' || !localColumns.has(c) || incoming[c] === local[c]);
  return !same && i.device_id > l.device_id;
}

/** O que mudaria, sem escrever nada. */
export async function previewMerge(db: DbAdapter, file: ExportFile): Promise<MergeReport> {
  return run(db, file, false);
}

/** Aplica o merge numa única transação: ou entra tudo, ou nada. */
export async function mergeData(db: DbAdapter, file: ExportFile): Promise<MergeReport> {
  let report!: MergeReport;
  try {
    await db.transaction(
      async (tx) => {
        report = await run(tx, file, true);
      },
      { foreignKeysOff: true },
    );
  } catch (err) {
    if (err instanceof MergeError) throw err;
    throw new MergeError('invalid', 'O ficheiro tem dados que não encaixam nesta base. Nada foi alterado.');
  }
  return report;
}

async function run(db: DbAdapter, file: ExportFile, write: boolean): Promise<MergeReport> {
  const report: MergeReport = { tables: {}, inserted: 0, updated: 0, skipped: 0 };
  for (const table of MERGE_TABLES) {
    const rows = file.tables[table];
    if (!rows?.length) continue;
    const info = await db.query<{ name: string }>(`PRAGMA table_info(${table})`);
    const local = new Set(info.map((c) => c.name));
    const tr: TableReport = { inserted: 0, updated: 0, skipped: 0 };
    for (const row of rows) {
      if (table === 'setting' && row['scope'] === 'DEVICE') continue; // definições deste dispositivo não viajam
      const found = await db.query<Row>(`SELECT * FROM ${table} WHERE id = ?`, [row['id']]);
      if (found.length && !shouldApply(row, found[0], local)) {
        tr.skipped++;
        continue;
      }
      if (found.length) tr.updated++;
      else tr.inserted++;
      if (!write) continue;
      const cols = Object.keys(row).filter((c) => local.has(c));
      const values = cols.map((c) => row[c]);
      const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
      await db.run(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        values,
      );
    }
    report.tables[table] = tr;
    report.inserted += tr.inserted;
    report.updated += tr.updated;
    report.skipped += tr.skipped;
  }
  return report;
}
