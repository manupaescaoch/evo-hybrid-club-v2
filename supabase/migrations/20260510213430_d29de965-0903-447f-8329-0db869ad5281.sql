CREATE OR REPLACE FUNCTION public.trg_pos_resposta_feedback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _now timestamptz := now();
  v_base date;
  v_limite date;
  v_inseriu boolean := false;
  v_nome text;
  v_disparar boolean := false;
BEGIN
  IF NEW.respondido = true
     AND COALESCE(OLD.respondido, false) = false
     AND NEW.aluno_id IS NOT NULL THEN
    v_disparar := true;
  END IF;

  IF NEW.respondido = true
     AND OLD.aluno_id IS NULL
     AND NEW.aluno_id IS NOT NULL THEN
    v_disparar := true;
  END IF;

  IF NOT v_disparar THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'feedback_quinzenal' THEN
    INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para, formulario_id)
    SELECT NEW.aluno_id, 'feedback_quinzenal_resposta'::job_tipo, _now + interval '2 hours', NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.jobs_disparos
      WHERE aluno_id=NEW.aluno_id AND tipo='feedback_quinzenal_resposta'::job_tipo AND executado=false
    );

  ELSIF NEW.tipo = 'feedback_mensal' THEN
    INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para, formulario_id)
    SELECT NEW.aluno_id, 'feedback_mensal_resposta'::job_tipo, _now + interval '2 hours', NEW.id
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

    -- Cria entrega_dia (atualização de planejamento) em D+3 úteis
    -- Aplica em ambos os casos (resposta nova ou vinculação tardia do aluno)
    v_base := CURRENT_DATE;
    v_limite := public.calcular_data_limite_entrega(v_base);
    SELECT nome INTO v_nome FROM public.alunos WHERE id = NEW.aluno_id;

    BEGIN
      INSERT INTO public.entregas_dia (aluno_id, data_referencia)
      VALUES (NEW.aluno_id, v_limite)
      ON CONFLICT (aluno_id, data_referencia) DO NOTHING;
      GET DIAGNOSTICS v_inseriu = ROW_COUNT;

      INSERT INTO public.entregas_dia_log
        (aluno_id, aluno_nome, origem, tipo_evento, data_referencia, data_base, resultado, detalhes)
      VALUES (
        NEW.aluno_id, v_nome, 'trg_pos_resposta_feedback', 'feedback_mensal',
        v_limite, v_base,
        CASE WHEN v_inseriu THEN 'criado' ELSE 'ja_existia' END,
        jsonb_build_object('formulario_id', NEW.id, 'caso', CASE WHEN COALESCE(OLD.respondido,false)=false THEN 'resposta_nova' ELSE 'vinculacao_tardia' END)
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.entregas_dia_log
        (aluno_id, aluno_nome, origem, tipo_evento, data_referencia, data_base, resultado, detalhes)
      VALUES (
        NEW.aluno_id, v_nome, 'trg_pos_resposta_feedback', 'feedback_mensal',
        v_limite, v_base, 'erro',
        jsonb_build_object('erro', SQLERRM, 'formulario_id', NEW.id)
      );
    END;
  END IF;

  RETURN NEW;
END;
$function$;