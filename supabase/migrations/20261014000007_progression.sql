-- Sugestão de carga: mecânica do exercício e faixa de repetições (mínimo; o máximo continua em target_reps).
-- As funções de sync leem as colunas da tabela, por isso não precisam de alteração. Seguro correr mais de uma vez.
ALTER TABLE exercise ADD COLUMN IF NOT EXISTS mechanic text;
ALTER TABLE planned_exercise ADD COLUMN IF NOT EXISTS target_reps_min integer;
ALTER TABLE session_exercise ADD COLUMN IF NOT EXISTS target_reps_min integer;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercise_mechanic_check') THEN
    ALTER TABLE exercise ADD CONSTRAINT exercise_mechanic_check CHECK (mechanic IN ('COMPOUND','ISOLATION'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planned_exercise_target_reps_min_check') THEN
    ALTER TABLE planned_exercise ADD CONSTRAINT planned_exercise_target_reps_min_check CHECK (target_reps_min >= 0);
  END IF;
END $$;
