DELETE FROM public.jobs_disparos
WHERE executado = false
  AND agendado_para < now() - interval '2 minutes';