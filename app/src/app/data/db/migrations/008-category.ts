/**
 * 008 — categoria do exercício (força, potência, cardio, HIIT, mobilidade, alongamento, equilíbrio, yoga/pilates).
 *
 * É uma divisão mais fina por cima de `kind`, que continua a mandar no comportamento e nas restrições.
 * NULL = usa a categoria por omissão do `kind`; por isso não há retro-preenchimento (nada fica «sujo» para o sync).
 */
export const MIGRATION_008 = `
ALTER TABLE exercise ADD COLUMN category TEXT
  CHECK (category IN ('STRENGTH','POWER','CARDIO','HIIT','MOBILITY','FLEXIBILITY','BALANCE','MINDBODY'));
`;
