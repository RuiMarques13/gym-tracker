/**
 * 013 — treinos planeados criados por um ciclo (semana-tipo). `cycle_id` diz de que ciclo veio; NULL = planeado teu.
 * Mover um planeado do ciclo para outro dia passa-o a teu (cycle_id NULL). Ver supabase/migrations/20261015000010_cycle_schedule.sql.
 */
export const MIGRATION_013 = `
ALTER TABLE scheduled_workout ADD COLUMN cycle_id TEXT;
CREATE INDEX ix_scheduled_cycle ON scheduled_workout(cycle_id);
`;
