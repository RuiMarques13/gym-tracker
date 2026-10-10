-- RIR (repetições em reserva) por série: 0–4, em que 4 = «4 ou mais». NULL = não registado.
-- Corre depois dos ficheiros 1 e 2. É seguro correr mais do que uma vez.
-- As funções de sync leem as colunas da tabela, por isso não precisam de alteração.
ALTER TABLE set_log ADD COLUMN IF NOT EXISTS rir integer;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'set_log_rir_check') THEN
    ALTER TABLE set_log ADD CONSTRAINT set_log_rir_check CHECK (rir BETWEEN 0 AND 4);
  END IF;
END $$;
