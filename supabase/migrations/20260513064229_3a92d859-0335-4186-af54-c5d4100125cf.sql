ALTER TYPE job_tipo ADD VALUE IF NOT EXISTS 'push_lembrete';
ALTER TABLE public.jobs_disparos ADD COLUMN IF NOT EXISTS payload jsonb;