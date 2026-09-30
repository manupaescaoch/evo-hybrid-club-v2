-- 1. Tabela entregas_dia
CREATE TABLE public.entregas_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  dieta_entregue boolean NOT NULL DEFAULT false,
  dieta_entregue_em timestamptz,
  dieta_entregue_por text,
  treino_entregue boolean NOT NULL DEFAULT false,
  treino_entregue_em timestamptz,
  treino_entregue_por text,
  d0_confirmado boolean NOT NULL DEFAULT false,
  d0_confirmado_em timestamptz,
  d0_confirmado_por text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, data_referencia)
);

CREATE INDEX idx_entregas_dia_data ON public.entregas_dia(data_referencia);
CREATE INDEX idx_entregas_dia_aluno ON public.entregas_dia(aluno_id);

ALTER TABLE public.entregas_dia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read entregas_dia" ON public.entregas_dia
  FOR SELECT TO authenticated
  USING (public.is_crm_user(auth.uid()));

CREATE POLICY "equipe insert entregas_dia" ON public.entregas_dia
  FOR INSERT TO authenticated
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "equipe update entregas_dia" ON public.entregas_dia
  FOR UPDATE TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()))
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin delete entregas_dia" ON public.entregas_dia
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. Colunas em formularios
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS confirmado_equipe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmado_por text;

-- 3. Função: dias úteis (seg-sex, sem feriados)
CREATE OR REPLACE FUNCTION public.calcular_data_limite_entrega(data_base date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d date := data_base;
  adicionados int := 0;
BEGIN
  WHILE adicionados < 3 LOOP
    d := d + INTERVAL '1 day';
    IF EXTRACT(ISODOW FROM d) < 6 THEN
      adicionados := adicionados + 1;
    END IF;
  END LOOP;
  RETURN d;
END;
$$;

-- 4. Trigger: criar entrega_dia ao mudar status
CREATE OR REPLACE FUNCTION public.trg_criar_entrega_dia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base date;
  v_limite date;
BEGIN
  IF NEW.status IN ('anamnese_recebida','em_producao')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_base := COALESCE(NEW.data_anamnese::date, CURRENT_DATE);
    v_limite := public.calcular_data_limite_entrega(v_base);
    INSERT INTO public.entregas_dia (aluno_id, data_referencia)
    VALUES (NEW.id, v_limite)
    ON CONFLICT (aluno_id, data_referencia) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alunos_criar_entrega ON public.alunos;
CREATE TRIGGER alunos_criar_entrega
AFTER UPDATE ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.trg_criar_entrega_dia();

-- 5. Trigger: ao completar 3 checks → ativar aluno
CREATE OR REPLACE FUNCTION public.trg_entrega_completa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dieta_entregue AND NEW.treino_entregue AND NEW.d0_confirmado
     AND NOT (OLD.dieta_entregue AND OLD.treino_entregue AND OLD.d0_confirmado) THEN
    UPDATE public.alunos
       SET status = 'ativo',
           data_d0 = COALESCE(data_d0, now()),
           data_expiracao = COALESCE(data_expiracao, now() + (prazo_dias || ' days')::interval)
     WHERE id = NEW.aluno_id AND status <> 'ativo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entregas_completar ON public.entregas_dia;
CREATE TRIGGER entregas_completar
AFTER UPDATE ON public.entregas_dia
FOR EACH ROW EXECUTE FUNCTION public.trg_entrega_completa();