
ALTER TABLE public.conversas_estado
  ADD COLUMN IF NOT EXISTS is_grupo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nome_grupo text,
  ADD COLUMN IF NOT EXISTS foto_grupo text,
  ADD COLUMN IF NOT EXISTS participantes_count integer;

CREATE INDEX IF NOT EXISTS idx_conversas_estado_is_grupo
  ON public.conversas_estado (is_grupo);

ALTER TABLE public.conversas_mensagens
  ADD COLUMN IF NOT EXISTS participante_telefone text,
  ADD COLUMN IF NOT EXISTS participante_nome text;
