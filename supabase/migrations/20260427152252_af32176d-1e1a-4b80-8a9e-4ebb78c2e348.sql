
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'motor-automacoes';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  v_jobid := cron.schedule(
    'motor-automacoes',
    '*/5 * * * *',
    $cmd$
    SELECT net.http_post(
      url := 'https://mpteam-crm.lovable.app/api/public/hooks/motor-automacoes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZ2Z2dnZ1b3FlZHFlZmh0b3Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTE4NjcsImV4cCI6MjA5MjIyNzg2N30.OlqkagSEs3pp2f2usgLFVKYNa0qCwF8zrKODDqfRY2k'
      ),
      body := '{}'::jsonb
    );
    $cmd$
  );

  -- Deixa DESATIVADO por padrão (active = false)
  PERFORM cron.alter_job(job_id := v_jobid, active := false);
END $$;

INSERT INTO public.workflow_config (secao, chave, valor, tipo)
SELECT 'motor', 'MOTOR_ATIVO', 'false', 'boolean'
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflow_config WHERE chave = 'MOTOR_ATIVO'
);
