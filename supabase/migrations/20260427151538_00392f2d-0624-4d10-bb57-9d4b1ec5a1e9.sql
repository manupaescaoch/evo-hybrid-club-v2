-- 0) Deduplica jobs pendentes legados (mantém o mais recente por aluno+tipo)
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY aluno_id, tipo ORDER BY criado_em DESC, id DESC) AS rn
  FROM public.jobs_disparos
  WHERE executado = false
)
DELETE FROM public.jobs_disparos j
USING ranked r
WHERE j.id = r.id AND r.rn > 1;

-- 1) Novos valores no enum job_tipo
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'anamnese_confirmacao';
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'followup_d7';
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'feedback_quinzenal_link';
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'followup_d21';
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'feedback_mensal_link';
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'feedback_quinzenal_resposta';
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'feedback_mensal_resposta';
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'pos_feedback_mensal';

-- 2) Índice único parcial para evitar duplicatas de jobs pendentes
CREATE UNIQUE INDEX IF NOT EXISTS jobs_disparos_aluno_tipo_pendente_uq
  ON public.jobs_disparos (aluno_id, tipo)
  WHERE executado = false;