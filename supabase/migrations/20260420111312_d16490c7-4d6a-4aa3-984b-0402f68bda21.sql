ALTER TABLE public.alunos ADD COLUMN cpf text;
CREATE UNIQUE INDEX alunos_cpf_unique ON public.alunos (cpf) WHERE cpf IS NOT NULL;