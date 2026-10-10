-- Categoria do exercício (força, potência, cardio, HIIT, mobilidade, alongamento, equilíbrio, yoga/pilates).
-- Divisão mais fina por cima de `kind`. NULL = categoria por omissão do kind.
-- As funções de sync leem as colunas da tabela, por isso não precisam de alteração.
-- É seguro correr mais do que uma vez.
ALTER TABLE exercise ADD COLUMN IF NOT EXISTS category text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercise_category_check') THEN
    ALTER TABLE exercise ADD CONSTRAINT exercise_category_check
      CHECK (category IN ('STRENGTH','POWER','CARDIO','HIIT','MOBILITY','FLEXIBILITY','BALANCE','MINDBODY'));
  END IF;
END $$;
