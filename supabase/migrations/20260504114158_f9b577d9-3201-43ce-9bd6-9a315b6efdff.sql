CREATE OR REPLACE FUNCTION public.next_brt_8am(base timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN (base AT TIME ZONE 'America/Sao_Paulo')::time <= '08:00:00'
      THEN ((base AT TIME ZONE 'America/Sao_Paulo')::date + time '08:00') AT TIME ZONE 'America/Sao_Paulo'
      ELSE ((base AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day' + time '08:00') AT TIME ZONE 'America/Sao_Paulo'
    END
$$;

CREATE OR REPLACE FUNCTION public.jobs_disparos_normalizar_horario()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Tipos com gatilho imediato (não normalizar)
  IF NEW.tipo IN (
    'ia_check_shape',
    'ia_feedback_quinzenal',
    'feedback_quinzenal_resposta',
    'feedback_mensal_resposta'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.agendado_para IS NOT NULL THEN
    NEW.agendado_para := public.next_brt_8am(NEW.agendado_para);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_disparos_normalizar_horario ON public.jobs_disparos;
CREATE TRIGGER trg_jobs_disparos_normalizar_horario
BEFORE INSERT ON public.jobs_disparos
FOR EACH ROW
EXECUTE FUNCTION public.jobs_disparos_normalizar_horario();

UPDATE public.jobs_disparos
SET agendado_para = public.next_brt_8am(agendado_para)
WHERE executado = false
  AND tipo NOT IN (
    'ia_check_shape',
    'ia_feedback_quinzenal',
    'feedback_quinzenal_resposta',
    'feedback_mensal_resposta'
  );