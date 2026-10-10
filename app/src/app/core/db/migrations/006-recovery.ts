/**
 * 006 — recuperação percebida por músculo.
 * Um registo por dia e músculo (id determinístico, por isso dois dispositivos no mesmo dia convergem).
 * soreness: 1 sem dor … 5 muito dorido. muscle usa os ids do spec (peito, costas_dorsais…).
 */
export const MIGRATION_006 = `
CREATE TABLE muscle_recovery (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  muscle TEXT NOT NULL,
  soreness INTEGER NOT NULL CHECK (soreness BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL
);
CREATE INDEX ix_muscle_recovery_muscle ON muscle_recovery(muscle, date);
`;
