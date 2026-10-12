/**
 * 009 — mais dados do relógio por sessão: calorias totais/basais, de onde vêm, passos, distância,
 * recuperação da FC, exercício registado e VO₂ máx. Continua a ser só local (reimporta-se do Health Connect).
 * `calories_kcal` passa a significar «ativas».
 */
export const MIGRATION_009 = `
ALTER TABLE session_health ADD COLUMN calories_total_kcal REAL;
ALTER TABLE session_health ADD COLUMN calories_basal_kcal REAL;
ALTER TABLE session_health ADD COLUMN calories_basis TEXT;
ALTER TABLE session_health ADD COLUMN steps INTEGER;
ALTER TABLE session_health ADD COLUMN distance_m REAL;
ALTER TABLE session_health ADD COLUMN hr_end_bpm INTEGER;
ALTER TABLE session_health ADD COLUMN hr_recovery_bpm INTEGER;
ALTER TABLE session_health ADD COLUMN exercise_type TEXT;
ALTER TABLE session_health ADD COLUMN exercise_seconds INTEGER;
ALTER TABLE session_health ADD COLUMN vo2max REAL;
`;
