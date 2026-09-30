CREATE TABLE public.planos_catalogo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  modalidade public.aluno_modalidade NOT NULL,
  valor_padrao numeric NOT NULL DEFAULT 0,
  duracao_dias integer NOT NULL DEFAULT 30,
  ativo boolean NOT NULL DEFAULT true,
  descricao text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.planos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read planos_catalogo"
ON public.planos_catalogo FOR SELECT TO authenticated
USING (public.is_crm_user(auth.uid()));

CREATE POLICY "admin write planos_catalogo"
ON public.planos_catalogo FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER planos_catalogo_set_atualizado_em
BEFORE UPDATE ON public.planos_catalogo
FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

CREATE INDEX idx_planos_catalogo_modalidade ON public.planos_catalogo(modalidade);
CREATE INDEX idx_planos_catalogo_ativo ON public.planos_catalogo(ativo);