/**
 * 007 — dados de saúde importados do relógio (Health Connect). Só locais: não sincronizam,
 * porque se podem voltar a importar a qualquer momento e pesam (uma amostra a cada ~10 s).
 */
export const MIGRATION_007 = `
CREATE TABLE hr_sample (
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  bpm INTEGER NOT NULL CHECK (bpm BETWEEN 20 AND 260),
  PRIMARY KEY (session_id, ts)
);
CREATE TABLE session_health (
  session_id TEXT PRIMARY KEY,
  avg_bpm INTEGER,
  max_bpm INTEGER,
  min_bpm INTEGER,
  samples INTEGER NOT NULL DEFAULT 0,
  calories_kcal REAL,
  source TEXT,
  imported_at TEXT NOT NULL
);
`;
