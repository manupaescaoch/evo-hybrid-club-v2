
-- ============ Tabelas ============

CREATE TABLE public.aluno_agua_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  ml integer NOT NULL CHECK (ml <> 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agua_aluno_data ON public.aluno_agua_log(aluno_id, data_referencia);
ALTER TABLE public.aluno_agua_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read agua" ON public.aluno_agua_log FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe write agua" ON public.aluno_agua_log FOR ALL TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE TABLE public.aluno_atividades_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('cardio','treino')),
  concluido boolean NOT NULL DEFAULT true,
  duracao_min integer,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, data_referencia, tipo)
);
ALTER TABLE public.aluno_atividades_dia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read atividades" ON public.aluno_atividades_dia FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe write atividades" ON public.aluno_atividades_dia FOR ALL TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE TABLE public.aluno_refeicoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  refeicao_id uuid,
  refeicao_nome text,
  feito_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, data_referencia, refeicao_id)
);
CREATE INDEX idx_refeicoes_aluno_data ON public.aluno_refeicoes_log(aluno_id, data_referencia);
ALTER TABLE public.aluno_refeicoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read refeicoes_log" ON public.aluno_refeicoes_log FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe write refeicoes_log" ON public.aluno_refeicoes_log FOR ALL TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));

-- ============ Score recalc ============

CREATE OR REPLACE FUNCTION public.recalcular_score_dia(_aluno_id uuid, _data date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score integer := 0;
  v_checkin daily_checkins%ROWTYPE;
  v_peso numeric;
  v_meta_agua_ml integer;
  v_agua_total integer;
  v_cardio boolean;
  v_treino boolean;
  v_refeicoes integer;
BEGIN
  IF _aluno_id IS NULL OR _data IS NULL THEN RETURN 0; END IF;

  SELECT * INTO v_checkin FROM public.daily_checkins
   WHERE aluno_id = _aluno_id AND data_checkin = _data
   ORDER BY updated_at DESC LIMIT 1;

  IF FOUND THEN
    v_score := v_score + 10;
    IF v_checkin.sono_horas IS NOT NULL AND v_checkin.sono_horas >= 7 THEN v_score := v_score + 5; END IF;
    IF v_checkin.humor IS NOT NULL AND v_checkin.humor >= 3 THEN v_score := v_score + 5; END IF;
    IF v_checkin.energia IS NOT NULL AND v_checkin.energia >= 3 THEN v_score := v_score + 5; END IF;
  END IF;

  SELECT peso_kg INTO v_peso FROM public.alunos WHERE id = _aluno_id;
  v_meta_agua_ml := CASE WHEN v_peso IS NOT NULL THEN ROUND(v_peso * 35) ELSE NULL END;

  SELECT COALESCE(SUM(ml),0) INTO v_agua_total
    FROM public.aluno_agua_log
   WHERE aluno_id = _aluno_id AND data_referencia = _data;

  IF v_meta_agua_ml IS NOT NULL AND v_agua_total >= v_meta_agua_ml THEN
    v_score := v_score + 10;
  END IF;

  SELECT bool_or(tipo='cardio' AND concluido), bool_or(tipo='treino' AND concluido)
    INTO v_cardio, v_treino
    FROM public.aluno_atividades_dia
   WHERE aluno_id = _aluno_id AND data_referencia = _data;

  IF COALESCE(v_cardio,false) THEN v_score := v_score + 15; END IF;
  IF COALESCE(v_treino,false) THEN v_score := v_score + 20; END IF;

  SELECT COUNT(*) INTO v_refeicoes
    FROM public.aluno_refeicoes_log
   WHERE aluno_id = _aluno_id AND data_referencia = _data;
  v_score := v_score + (v_refeicoes * 3);

  IF FOUND OR v_agua_total > 0 OR COALESCE(v_cardio,false) OR COALESCE(v_treino,false) OR v_refeicoes > 0 THEN
    INSERT INTO public.daily_checkins (aluno_id, data_checkin, score_gerado)
    VALUES (_aluno_id, _data, v_score)
    ON CONFLICT (aluno_id, data_checkin) DO UPDATE
      SET score_gerado = EXCLUDED.score_gerado,
          updated_at = now();
  END IF;

  RETURN v_score;
END;
$$;

-- daily_checkins precisa de unique para upsert
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_checkins_aluno_data
  ON public.daily_checkins(aluno_id, data_checkin);

-- ============ Triggers ============

CREATE OR REPLACE FUNCTION public.tg_recalc_score_agua()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_score_dia(COALESCE(NEW.aluno_id, OLD.aluno_id),
                                       COALESCE(NEW.data_referencia, OLD.data_referencia));
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_agua_score
AFTER INSERT OR UPDATE OR DELETE ON public.aluno_agua_log
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_score_agua();

CREATE TRIGGER trg_atividades_score
AFTER INSERT OR UPDATE OR DELETE ON public.aluno_atividades_dia
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_score_agua();

CREATE TRIGGER trg_refeicoes_score
AFTER INSERT OR UPDATE OR DELETE ON public.aluno_refeicoes_log
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_score_agua();

-- Trigger no daily_checkins: recalcula quando humor/sono/energia mudam (evitando loop em score_gerado)
CREATE OR REPLACE FUNCTION public.tg_recalc_score_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     NEW.humor IS NOT DISTINCT FROM OLD.humor AND
     NEW.sono_horas IS NOT DISTINCT FROM OLD.sono_horas AND
     NEW.energia IS NOT DISTINCT FROM OLD.energia AND
     NEW.qualidade_sono IS NOT DISTINCT FROM OLD.qualidade_sono THEN
    RETURN NEW;
  END IF;
  PERFORM public.recalcular_score_dia(NEW.aluno_id, NEW.data_checkin);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_checkin_score
AFTER INSERT OR UPDATE ON public.daily_checkins
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_score_checkin();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.aluno_agua_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.aluno_atividades_dia;
ALTER PUBLICATION supabase_realtime ADD TABLE public.aluno_refeicoes_log;

-- updated_at triggers
CREATE TRIGGER trg_atividades_updated
BEFORE UPDATE ON public.aluno_atividades_dia
FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
