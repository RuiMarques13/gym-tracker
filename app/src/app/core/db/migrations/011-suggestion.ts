/**
 * 011 — histórico das sugestões de progressão (especificação «Progressão e ciclos», fase 3).
 * Uma linha por resposta tua a uma sugestão: aceite ou recusada. Serve para não repetir o que recusaste e para
 * a resposta seguinte à estagnação (volume → faixa → troca) saber o que já fizeste no mesmo episódio.
 * - kind: STAGNATION (exercício estagnado) ou FATIGUE (sinais de fadiga).
 * - episode: o que identifica o episódio (sessão do último progresso do exercício, ou a semana da fadiga).
 * - response: deload, volume, range ou swap. payload: JSON com os valores aplicados.
 * Id determinístico (kind, exercício, episódio, resposta): dois dispositivos convergem. Sincroniza; ver
 * supabase/migrations/20261015000008_suggestion.sql.
 */
export const MIGRATION_011 = `
CREATE TABLE suggestion (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('STAGNATION','FATIGUE')),
  exercise_id TEXT,
  episode TEXT NOT NULL,
  response TEXT CHECK (response IN ('deload','volume','range','swap')),
  status TEXT NOT NULL CHECK (status IN ('ACCEPTED','DECLINED')),
  payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL
);
CREATE INDEX ix_suggestion_exercise ON suggestion(exercise_id, episode);
`;
