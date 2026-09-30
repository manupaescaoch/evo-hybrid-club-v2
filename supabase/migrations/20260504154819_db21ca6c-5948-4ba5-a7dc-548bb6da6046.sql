CREATE OR REPLACE FUNCTION public.trg_pos_anamnese()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base date;
  v_limite date;
  v_inseriu boolean := false;
  v_nome text;
  v_disparar boolean := false;
BEGIN
  IF NEW.tipo <> 'anamnese' OR NEW.aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Caso 1: respondido virou true agora (aluno já vinculado)
  IF NEW.respondido = true AND COALESCE(OLD.respondido, false) = false THEN
    v_disparar := true;
  END IF;

  -- Caso 2: aluno_id foi vinculado agora num update separado, com respondido já true
  IF NEW.respondido = true
     AND OLD.aluno_id IS NULL
     AND NEW.aluno_id IS NOT NULL THEN
    v_disparar := true;
  END IF;

  IF NOT v_disparar THEN
    RETURN NEW;
  END IF;

  -- Agenda confirmação (idempotente)
  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT NEW.aluno_id, 'anamnese_confirmacao'::job_tipo, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=NEW.aluno_id AND tipo='anamnese_confirmacao'::job_tipo AND executado=false
  );

  v_base := COALESCE(NEW.respondido_em::date, CURRENT_DATE);
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
      NEW.aluno_id, v_nome, 'trg_pos_anamnese', 'anamnese_publica',
      v_limite, v_base,
      CASE WHEN v_inseriu THEN 'criado' ELSE 'ja_existia' END,
      jsonb_build_object('formulario_id', NEW.id, 'origem_form', NEW.origem)
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.entregas_dia_log
      (aluno_id, aluno_nome, origem, tipo_evento, data_referencia, data_base, resultado, detalhes)
    VALUES (
      NEW.aluno_id, v_nome, 'trg_pos_anamnese', 'anamnese_publica',
      v_limite, v_base, 'erro',
      jsonb_build_object('erro', SQLERRM, 'formulario_id', NEW.id)
    );
  END;

  RETURN NEW;
END;
$function$;