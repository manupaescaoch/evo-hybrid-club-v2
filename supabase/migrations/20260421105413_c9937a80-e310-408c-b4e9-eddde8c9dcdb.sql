ALTER TABLE public.dieta_planos ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS altura_cm numeric;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS peso_kg numeric;