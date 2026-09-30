CREATE OR REPLACE FUNCTION public.jobs_disparos_normalizar_horario()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo IN (
    'anamnese_confirmacao',
    'anamnese_recebida',
    'ia_check_shape',
    'ia_feedback_quinzenal',
    'aniversario'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo IN (
    'feedback_quinzenal_resposta',
    'feedback_mensal_resposta',
    'pos_feedback_mensal',
    'followup_d7',
    'followup_d21',
    'feedback_quinzenal_link',
    'feedback_mensal_link',
    'feedback_link_lembrete'
  ) THEN
    IF NEW.agendado_para IS NOT NULL THEN
      NEW.agendado_para := public.next_brt_business_window(NEW.agendado_para);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.agendado_para IS NOT NULL THEN
    NEW.agendado_para := public.next_brt_8am(NEW.agendado_para);
  END IF;
  RETURN NEW;
END;
$function$;