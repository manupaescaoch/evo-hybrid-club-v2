ALTER TABLE public.conversas_estado
  ADD COLUMN IF NOT EXISTS fixada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_conversas_estado_fixada
  ON public.conversas_estado (fixada DESC, ultima_mensagem_em DESC);