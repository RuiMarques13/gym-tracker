/**
 * 014 — formato de um grupo de exercícios (superset, circuito, Tabata, EMOM, AMRAP, intervalos).
 * Um grupo são os exercícios seguidos com a mesma letra em `superset_group` (planned_exercise ou session_exercise);
 * esta tabela guarda o formato desse grupo num treino (`template_id`) ou numa sessão (`session_id`, copiado do treino
 * ao começar, com o resultado dos formatos por tempo). Sem linha, o grupo é um superset (como antes).
 * Sincroniza; ver supabase/migrations/20261021000012_exercise_group.sql.
 */
export const MIGRATION_014 = `
CREATE TABLE exercise_group (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  session_id TEXT,
  group_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  rounds INTEGER,
  round_rest_seconds INTEGER,
  work_seconds INTEGER,
  rest_seconds INTEGER,
  duration_seconds INTEGER,
  result_rounds INTEGER,
  result_reps INTEGER,
  result_seconds INTEGER,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL
);
CREATE INDEX ix_exercise_group_template ON exercise_group(template_id);
CREATE INDEX ix_exercise_group_session ON exercise_group(session_id);
`;
