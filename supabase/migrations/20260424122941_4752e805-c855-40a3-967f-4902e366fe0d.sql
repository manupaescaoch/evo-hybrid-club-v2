CREATE TABLE public.mensagens_dieta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  ajustes_realizados text NOT NULL,
  dificuldades text,
  medidas_otimizacao text NOT NULL,
  mensagem_gerada text,
  enviado_whatsapp_em timestamptz,
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_dieta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm users read mensagens_dieta" ON public.mensagens_dieta
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));

CREATE POLICY "equipe insert mensagens_dieta" ON public.mensagens_dieta
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin delete mensagens_dieta" ON public.mensagens_dieta
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE INDEX idx_mensagens_dieta_aluno ON public.mensagens_dieta(aluno_id, criado_em DESC);