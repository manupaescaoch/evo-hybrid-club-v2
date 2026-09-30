
CREATE OR REPLACE FUNCTION public.agendar_jobs_apos_entrega(_aluno_id uuid, _d0 timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _aluno_id IS NULL OR _d0 IS NULL THEN RETURN; END IF;

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'pos_entrega_d1'::job_tipo,
         (((_d0 AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day')::timestamp) AT TIME ZONE 'America/Sao_Paulo'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='pos_entrega_d1'::job_tipo AND executado=false
  );

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'followup_d7'::job_tipo, _d0 + interval '7 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='followup_d7'::job_tipo AND executado=false
  );

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'feedback_quinzenal_link'::job_tipo, _d0 + interval '15 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='feedback_quinzenal_link'::job_tipo AND executado=false
  );

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'followup_d21'::job_tipo, _d0 + interval '21 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='followup_d21'::job_tipo AND executado=false
  );

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'feedback_mensal_link'::job_tipo, _d0 + interval '30 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='feedback_mensal_link'::job_tipo AND executado=false
  );
END;
$function$;
