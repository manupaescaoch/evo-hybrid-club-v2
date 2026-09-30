-- Cria enum para tipo de serviço contratado
DO $$ BEGIN
  CREATE TYPE public.aluno_servico AS ENUM ('treino_e_dieta', 'dieta', 'treino');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adiciona coluna na tabela alunos
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS servico_contratado public.aluno_servico DEFAULT 'treino_e_dieta';