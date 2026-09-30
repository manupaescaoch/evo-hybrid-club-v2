-- Função: agenda os 4 jobs ancorados no D0
CREATE OR REPLACE FUNCTION public.agendar_jobs_apos_entrega(_aluno_id uuid, _d0 timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _aluno_id IS NULL OR _d0 IS NULL THEN RETURN; END IF;

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
$$;

-- Trigger: primeira entrega -> agenda jobs
CREATE OR REPLACE FUNCTION public.trg_agendar_apos_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _antes_dieta boolean := COALESCE(OLD.dieta_entregue, false);
  _antes_treino boolean := COALESCE(OLD.treino_entregue, false);
  _depois_dieta boolean := COALESCE(NEW.dieta_entregue, false);
  _depois_treino boolean := COALESCE(NEW.treino_entregue, false);
  _virou_primeiro boolean;
  _d0 timestamptz;
BEGIN
  _virou_primeiro := (NOT _antes_dieta AND NOT _antes_treino)
                     AND (_depois_dieta OR _depois_treino);
  IF NOT _virou_primeiro THEN RETURN NEW; END IF;

  _d0 := LEAST(
    COALESCE(NEW.dieta_entregue_em, NEW.treino_entregue_em),
    COALESCE(NEW.treino_entregue_em, NEW.dieta_entregue_em)
  );
  IF _d0 IS NULL THEN _d0 := now(); END IF;

  PERFORM public.agendar_jobs_apos_entrega(NEW.aluno_id, _d0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendar_apos_entrega ON public.entregas_dia;
CREATE TRIGGER trg_agendar_apos_entrega
AFTER UPDATE ON public.entregas_dia
FOR EACH ROW EXECUTE FUNCTION public.trg_agendar_apos_entrega();

-- Trigger: anamnese finalizada -> agenda confirmacao imediata
CREATE OR REPLACE FUNCTION public.trg_pos_anamnese()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_anamnese ON public.formularios;
CREATE TRIGGER trg_pos_anamnese
AFTER UPDATE ON public.formularios
FOR EACH ROW EXECUTE FUNCTION public.trg_pos_anamnese();

-- Trigger: resposta de feedback quinzenal/mensal -> agenda resposta IA (+2h) e pos-feedback
CREATE OR REPLACE FUNCTION public.trg_pos_resposta_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
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
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_resposta_feedback ON public.formularios;
CREATE TRIGGER trg_pos_resposta_feedback
AFTER UPDATE ON public.formularios
FOR EACH ROW EXECUTE FUNCTION public.trg_pos_resposta_feedback();