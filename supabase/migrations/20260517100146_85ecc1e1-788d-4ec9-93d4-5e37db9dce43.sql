
-- Treino plan (workout) created by trainer for a student
CREATE TABLE IF NOT EXISTS public.treinos_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  nome text NOT NULL DEFAULT 'Treino',
  objetivo text,
  duracao_min integer,
  distancia_km numeric,
  pace_alvo text,
  zona_fc text,
  observacao text,
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treinos_planos_aluno ON public.treinos_planos(aluno_id, atualizado_em DESC);

ALTER TABLE public.treinos_planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read treinos_planos" ON public.treinos_planos
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert treinos_planos" ON public.treinos_planos
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update treinos_planos" ON public.treinos_planos
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete treinos_planos" ON public.treinos_planos
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Blocks belonging to a workout
CREATE TABLE IF NOT EXISTS public.treinos_blocos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treino_id uuid NOT NULL REFERENCES public.treinos_planos(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'rodagem',
  nome text NOT NULL DEFAULT '',
  descricao text,
  duracao text,
  pace text,
  zona text,
  series text,
  distancia_serie text,
  recuperacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treinos_blocos_treino ON public.treinos_blocos(treino_id, ordem);

ALTER TABLE public.treinos_blocos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read treinos_blocos" ON public.treinos_blocos
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert treinos_blocos" ON public.treinos_blocos
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update treinos_blocos" ON public.treinos_blocos
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe delete treinos_blocos" ON public.treinos_blocos
  FOR DELETE TO authenticated USING (is_equipe_or_admin(auth.uid()));

-- Trigger to keep atualizado_em fresh
CREATE OR REPLACE FUNCTION public.tg_treinos_planos_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_treinos_planos_touch ON public.treinos_planos;
CREATE TRIGGER trg_treinos_planos_touch
  BEFORE UPDATE ON public.treinos_planos
  FOR EACH ROW EXECUTE FUNCTION public.tg_treinos_planos_touch();
