
-- 1. Add new prompt types
ALTER TYPE public.prompt_tipo ADD VALUE IF NOT EXISTS 'followup_d7';
ALTER TYPE public.prompt_tipo ADD VALUE IF NOT EXISTS 'followup_d21';

-- 2. Create pontos_contato table
CREATE TABLE IF NOT EXISTS public.pontos_contato (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  prompt_tipo public.prompt_tipo NOT NULL,
  gatilho_tipo text NOT NULL DEFAULT 'dias_apos_entrega',
  gatilho_valor integer NOT NULL DEFAULT 7,
  canal text NOT NULL DEFAULT 'whatsapp',
  condicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_envio_em timestamptz,
  total_envios integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pontos_contato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read pontos_contato"
  ON public.pontos_contato FOR SELECT
  TO authenticated
  USING (is_crm_user(auth.uid()));

CREATE POLICY "equipe write pontos_contato"
  ON public.pontos_contato FOR ALL
  TO authenticated
  USING (is_equipe_or_admin(auth.uid()))
  WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE TRIGGER tg_pontos_contato_atualizado_em
  BEFORE UPDATE ON public.pontos_contato
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
