SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'motor-automacoes'),
  active := true
);