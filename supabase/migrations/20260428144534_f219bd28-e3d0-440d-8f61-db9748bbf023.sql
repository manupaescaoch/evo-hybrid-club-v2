CREATE OR REPLACE FUNCTION public.trg_entrega_completa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_inicio timestamptz;
  v_data_anamnese timestamptz;
BEGIN
  IF NEW.dieta_entregue AND NEW.treino_entregue AND NEW.d0_confirmado
     AND NOT (OLD.dieta_entregue AND OLD.treino_entregue AND OLD.d0_confirmado) THEN

    -- Busca data_anamnese do aluno
    SELECT data_anamnese INTO v_data_anamnese
      FROM public.alunos WHERE id = NEW.aluno_id;

    -- Regra: se aluno preencheu anamnese, data_d0 = data_anamnese
    -- Se NÃO preencheu anamnese, data_d0 = agora (data da entrega do planejamento)
    v_data_inicio := COALESCE(v_data_anamnese, now());

    UPDATE public.alunos
       SET status = 'ativo',
           data_d0 = COALESCE(data_d0, v_data_inicio),
           data_expiracao = COALESCE(data_expiracao, v_data_inicio + (prazo_dias || ' days')::interval)
     WHERE id = NEW.aluno_id AND status <> 'ativo';
  END IF;
  RETURN NEW;
END;
$function$;