/**
 * 004 — RIR (repetições em reserva) por série.
 * 0–4, em que 4 significa «4 ou mais». NULL = não registado (conta como série efetiva).
 */
export const MIGRATION_004 = `
ALTER TABLE set_log ADD COLUMN rir INTEGER CHECK (rir BETWEEN 0 AND 4);
`;
