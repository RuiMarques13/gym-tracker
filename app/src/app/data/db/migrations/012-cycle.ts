/**
 * 012 — ciclos de treino (especificação «Progressão e ciclos», fase 5).
 * Um macrociclo por linha; os mesociclos e as semanas vão em `plan` (JSON), porque se editam sempre juntos e assim o
 * sync («última escrita ganha» por linha) nunca mistura semanas de versões diferentes. A semana em curso calcula-se
 * pela data de início. Sincroniza; ver supabase/migrations/20261015000009_cycle.sql.
 */
export const MIGRATION_012 = `
CREATE TABLE training_cycle (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  template TEXT NOT NULL,
  start_date TEXT NOT NULL,
  plan TEXT NOT NULL,
  notes TEXT,
  archived_at TEXT,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL
);
`;
