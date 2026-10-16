/**
 * 005 — fotos de progresso.
 * A imagem fica na própria linha, como data URL JPEG já reduzida (≈ 60 KB), para sincronizar
 * como qualquer outra tabela. date é a data local da foto (YYYY-MM-DD).
 */
export const MIGRATION_005 = `
CREATE TABLE progress_photo (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  pose TEXT NOT NULL DEFAULT 'FRONT' CHECK (pose IN ('FRONT','SIDE','BACK','OTHER')),
  note TEXT,
  image TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL
);
CREATE INDEX ix_progress_photo_date ON progress_photo(date);
`;
