CREATE TABLE public.prescricoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id uuid NOT NULL,
  titulo text,
  data date,
  descricao text,
  posologia text,
  suplementos jsonb NOT NULL DEFAULT '[]'::jsonb,
  fitoterapicos jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prescricoes_aluno ON public.prescricoes(aluno_id, atualizado_em DESC);

ALTER TABLE public.prescricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read prescricoes" ON public.prescricoes
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));

CREATE POLICY "equipe insert prescricoes" ON public.prescricoes
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "equipe update prescricoes" ON public.prescricoes
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin delete prescricoes" ON public.prescricoes
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_prescricoes_set_atualizado
  BEFORE UPDATE ON public.prescricoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();