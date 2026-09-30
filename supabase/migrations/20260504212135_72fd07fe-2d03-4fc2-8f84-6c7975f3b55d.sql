
CREATE OR REPLACE FUNCTION public.jobs_disparos_normalizar_horario()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.tipo IN (
    'ia_check_shape',
    'ia_feedback_quinzenal',
    'feedback_quinzenal_resposta',
    'feedback_mensal_resposta',
    'aniversario'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.agendado_para IS NOT NULL THEN
    NEW.agendado_para := public.next_brt_8am(NEW.agendado_para);
  END IF;

  RETURN NEW;
END;
$function$;
