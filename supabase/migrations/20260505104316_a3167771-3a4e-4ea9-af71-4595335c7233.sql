-- Add new job type for feedback reminder
ALTER TYPE public.job_tipo ADD VALUE IF NOT EXISTS 'feedback_link_lembrete';

-- Add formulario_id column to jobs_disparos so we can target a specific form
ALTER TABLE public.jobs_disparos
  ADD COLUMN IF NOT EXISTS formulario_id uuid;

CREATE INDEX IF NOT EXISTS idx_jobs_disparos_formulario_id
  ON public.jobs_disparos(formulario_id)
  WHERE formulario_id IS NOT NULL;