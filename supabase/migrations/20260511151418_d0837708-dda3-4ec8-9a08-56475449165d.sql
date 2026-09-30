
ALTER TABLE public.agente_config
  ADD COLUMN IF NOT EXISTS modo_envio text NOT NULL DEFAULT 'validacao_grupo',
  ADD COLUMN IF NOT EXISTS grupo_interno_nome text,
  ADD COLUMN IF NOT EXISTS grupo_interno_zapi_id text,
  ADD COLUMN IF NOT EXISTS grupo_interno_ultimo_envio_em timestamptz;

ALTER TABLE public.agente_config
  DROP CONSTRAINT IF EXISTS agente_config_modo_envio_chk;

ALTER TABLE public.agente_config
  ADD CONSTRAINT agente_config_modo_envio_chk
  CHECK (modo_envio IN ('validacao_grupo', 'envio_automatico'));
