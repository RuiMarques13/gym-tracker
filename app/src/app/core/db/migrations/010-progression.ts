/**
 * 010 — sugestão de carga.
 * - `exercise.mechanic`: multiarticular (COMPOUND) ou monoarticular (ISOLATION); decide quanto subir (2–10%, ACSM 2009).
 * - `target_reps_min` no treino e no snapshot da sessão: com `target_reps` (o máximo) forma a faixa de repetições.
 * NULL em todas = comportamento antigo (um só alvo). Sincroniza; ver supabase/migrations/20261014000007_progression.sql.
 */
export const MIGRATION_010 = `
ALTER TABLE exercise ADD COLUMN mechanic TEXT CHECK (mechanic IN ('COMPOUND','ISOLATION'));
ALTER TABLE planned_exercise ADD COLUMN target_reps_min INTEGER CHECK (target_reps_min >= 0);
ALTER TABLE session_exercise ADD COLUMN target_reps_min INTEGER;
`;
