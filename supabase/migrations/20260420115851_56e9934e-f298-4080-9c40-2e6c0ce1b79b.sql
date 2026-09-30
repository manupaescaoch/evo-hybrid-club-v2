-- Add 'treino' to prompt_tipo enum
ALTER TYPE public.prompt_tipo ADD VALUE IF NOT EXISTS 'treino';

-- Create mensagens_treino table
CREATE TABLE IF NOT EXISTS public.mensagens_treino (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  ajustes_realizados text NOT NULL,
  dificuldades text,
  medidas_otimizacao text NOT NULL,
  mensagem_gerada text,
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_treino_aluno ON public.mensagens_treino(aluno_id, criado_em DESC);

ALTER TABLE public.mensagens_treino ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm users read mensagens_treino"
  ON public.mensagens_treino FOR SELECT
  TO authenticated
  USING (public.is_crm_user(auth.uid()));

CREATE POLICY "equipe insert mensagens_treino"
  ON public.mensagens_treino FOR INSERT
  TO authenticated
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin delete mensagens_treino"
  ON public.mensagens_treino FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));