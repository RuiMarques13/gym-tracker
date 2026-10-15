-- Treinos planeados criados por um ciclo (semana-tipo). As funções de sync leem as colunas da tabela, por isso não
-- precisam de alteração. Seguro correr mais de uma vez. Corre depois dos ficheiros 1 a 9.
ALTER TABLE scheduled_workout ADD COLUMN IF NOT EXISTS cycle_id uuid;
