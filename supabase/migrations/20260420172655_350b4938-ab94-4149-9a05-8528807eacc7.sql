CREATE TABLE public.financeiro_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dias_alerta_vencimento int NOT NULL DEFAULT 5,
  mensagem_cobranca text NOT NULL DEFAULT 'Olá {{nome}}, seu plano vence em {{dias}} dias. Renove para não perder o acesso.',
  juros_pct numeric NOT NULL DEFAULT 0,
  multa_pct numeric NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read financeiro_config"
ON public.financeiro_config FOR SELECT TO authenticated
USING (public.is_crm_user(auth.uid()));

CREATE POLICY "admin write financeiro_config"
ON public.financeiro_config FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER set_financeiro_config_atualizado_em
BEFORE UPDATE ON public.financeiro_config
FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

INSERT INTO public.financeiro_config (dias_alerta_vencimento, mensagem_cobranca, juros_pct, multa_pct)
VALUES (5, 'Olá {{nome}}, seu plano vence em {{dias}} dias. Renove para não perder o acesso.', 0, 0);