CREATE TABLE public.prescricao_modelos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  posologia TEXT,
  suplementos JSONB NOT NULL DEFAULT '[]'::jsonb,
  fitoterapicos JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacoes TEXT,
  criado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescricao_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read prescricao_modelos"
  ON public.prescricao_modelos FOR SELECT TO authenticated
  USING (is_crm_user(auth.uid()));

CREATE POLICY "equipe insert prescricao_modelos"
  ON public.prescricao_modelos FOR INSERT TO authenticated
  WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "equipe update prescricao_modelos"
  ON public.prescricao_modelos FOR UPDATE TO authenticated
  USING (is_equipe_or_admin(auth.uid()))
  WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin delete prescricao_modelos"
  ON public.prescricao_modelos FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_prescricao_modelos_set_updated()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prescricao_modelos_updated
  BEFORE UPDATE ON public.prescricao_modelos
  FOR EACH ROW EXECUTE FUNCTION public.tg_prescricao_modelos_set_updated();