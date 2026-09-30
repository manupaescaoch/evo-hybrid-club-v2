-- Anamnese pública: ao responder, criar entrega_dia D+3 úteis
CREATE OR REPLACE FUNCTION public.trg_pos_anamnese()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite date;
BEGIN
  IF NEW.tipo = 'anamnese'
     AND NEW.respondido = true
     AND COALESCE(OLD.respondido, false) = false
     AND NEW.aluno_id IS NOT NULL THEN

    INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
    SELECT NEW.aluno_id, 'anamnese_confirmacao'::job_tipo, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.jobs_disparos
      WHERE aluno_id=NEW.aluno_id AND tipo='anamnese_confirmacao'::job_tipo AND executado=false
    );

    v_limite := public.calcular_data_limite_entrega(CURRENT_DATE);
    INSERT INTO public.entregas_dia (aluno_id, data_referencia)
    VALUES (NEW.aluno_id, v_limite)
    ON CONFLICT (aluno_id, data_referencia) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Feedback mensal: ao responder, criar entrega_dia D+3 úteis (atualização de planejamento)
CREATE OR REPLACE FUNCTION public.trg_pos_resposta_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  v_limite date;
BEGIN
  IF NEW.respondido = true
     AND COALESCE(OLD.respondido, false) = false
     AND NEW.aluno_id IS NOT NULL THEN

    IF NEW.tipo = 'feedback_quinzenal' THEN
      INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
      SELECT NEW.aluno_id, 'feedback_quinzenal_resposta'::job_tipo, _now + interval '2 hours'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.jobs_disparos
        WHERE aluno_id=NEW.aluno_id AND tipo='feedback_quinzenal_resposta'::job_tipo AND executado=false
      );

    ELSIF NEW.tipo = 'feedback_mensal' THEN
      INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
      SELECT NEW.aluno_id, 'feedback_mensal_resposta'::job_tipo, _now + interval '2 hours'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.jobs_disparos
        WHERE aluno_id=NEW.aluno_id AND tipo='feedback_mensal_resposta'::job_tipo AND executado=false
      );

      INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
      SELECT NEW.aluno_id, 'pos_feedback_mensal'::job_tipo, _now + interval '2 hours 5 minutes'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.jobs_disparos
        WHERE aluno_id=NEW.aluno_id AND tipo='pos_feedback_mensal'::job_tipo AND executado=false
      );

      v_limite := public.calcular_data_limite_entrega(CURRENT_DATE);
      INSERT INTO public.entregas_dia (aluno_id, data_referencia)
      VALUES (NEW.aluno_id, v_limite)
      ON CONFLICT (aluno_id, data_referencia) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
