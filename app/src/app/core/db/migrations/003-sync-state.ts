/**
 * 003 — estado do sync (só local, nunca sincroniza).
 *
 * sync_row guarda, por linha, a última versão (updated_at, device_id) que o servidor conhece.
 * Uma linha local está «por enviar» quando difere desta. Funciona mesmo com o relógio do
 * telemóvel atrasado, ao contrário de «enviar o que mudou desde a última vez».
 */
export const MIGRATION_003 = `
CREATE TABLE sync_row (
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (table_name, row_id)
);
`;
