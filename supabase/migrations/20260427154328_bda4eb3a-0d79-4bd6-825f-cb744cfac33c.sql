-- Tabela de log
CREATE TABLE public.entregas_dia_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id uuid,
  aluno_nome text,
  origem text NOT NULL,
  tipo_evento text NOT NULL,
  data_referencia date,
  data_base date,
  resultado text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entregas_dia_log_criado_em ON public.entregas_dia_log (criado_em DESC);
CREATE INDEX idx_entregas_dia_log_aluno ON public.entregas_dia_log (aluno_id, criado_em DESC);
CREATE INDEX idx_entregas_dia_log_resultado ON public.entregas_dia_log (resultado);
CREATE INDEX idx_entregas_dia_log_tipo ON public.entregas_dia_log (tipo_evento);

ALTER TABLE public.entregas_dia_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read entregas_dia_log"
  ON public.entregas_dia_log FOR SELECT
  TO authenticated
  USING (public.is_crm_user(auth.uid()));

CREATE POLICY "anyone insert entregas_dia_log"
  ON public.entregas_dia_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admin update entregas_dia_log"
  ON public.entregas_dia_log FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete entregas_dia_log"
  ON public.entregas_dia_log FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Atualiza trigger: criação inicial via mudança de status do aluno
CREATE OR REPLACE FUNCTION public.trg_criar_entrega_dia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base date;
  v_limite date;
  v_inseriu boolean := false;
BEGIN
  IF NEW.status IN ('anamnese_recebida','em_producao')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_base := COALESCE(NEW.data_anamnese::date, CURRENT_DATE);
    v_limite := public.calcular_data_limite_entrega(v_base);

    BEGIN
      INSERT INTO public.entregas_dia (aluno_id, data_referencia)
      VALUES (NEW.id, v_limite)
      ON CONFLICT (aluno_id, data_referencia) DO NOTHING;
      GET DIAGNOSTICS v_inseriu = ROW_COUNT;

      INSERT INTO public.entregas_dia_log
        (aluno_id, aluno_nome, origem, tipo_evento, data_referencia, data_base, resultado, detalhes)
      VALUES (
        NEW.id, NEW.nome, 'trg_criar_entrega_dia', 'entrega_inicial',
        v_limite, v_base,
        CASE WHEN v_inseriu THEN 'criado' ELSE 'ja_existia' END,
        jsonb_build_object('status_anterior', OLD.status, 'status_novo', NEW.status)
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.entregas_dia_log
        (aluno_id, aluno_nome, origem, tipo_evento, data_referencia, data_base, resultado, detalhes)
      VALUES (
        NEW.id, NEW.nome, 'trg_criar_entrega_dia', 'entrega_inicial',
        v_limite, v_base, 'erro',
        jsonb_build_object('erro', SQLERRM, 'status_anterior', OLD.status, 'status_novo', NEW.status)
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualiza trigger: pós-anamnese (cria entrega_dia em anamnese pública respondida)
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
BEGIN
  IF NEW.tipo = 'anamnese'
     AND NEW.respondido = true
     AND COALESCE(OLD.respondido, false) = false
     AND NEW.aluno_id IS NOT NULL THEN

    -- Mantém comportamento original: agenda confirmação
    INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
    SELECT NEW.aluno_id, 'anamnese_confirmacao'::job_tipo, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.jobs_disparos
      WHERE aluno_id=NEW.aluno_id AND tipo='anamnese_confirmacao'::job_tipo AND executado=false
    );

    -- Cria entrega_dia em D+3 úteis para anamnese pública
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
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualiza trigger: pós-resposta de feedback (mensal cria entrega_dia)
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

      -- Cria entrega_dia (atualização de planejamento) em D+3 úteis
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
          jsonb_build_object('formulario_id', NEW.id)
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
  END IF;
  RETURN NEW;
END;
$function$;