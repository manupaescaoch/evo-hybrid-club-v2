
-- Coluna de inclinação padrão de esteira no perfil
ALTER TABLE public.corrida_perfil
  ADD COLUMN IF NOT EXISTS inclinacao_esteira_pct integer NOT NULL DEFAULT 1;

-- Guardar parâmetros do wizard que geraram o microciclo (pra "regerar")
ALTER TABLE public.corrida_microciclos
  ADD COLUMN IF NOT EXISTS params_geracao jsonb,
  ADD COLUMN IF NOT EXISTS macrociclo_id uuid,
  ADD COLUMN IF NOT EXISTS ordem_no_macro integer;

-- Tabela de macrociclos (semanas geradas em lote)
CREATE TABLE IF NOT EXISTS public.corrida_macrociclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  nome text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  semanas_total integer NOT NULL,
  modelo_periodizacao text NOT NULL DEFAULT 'linear',
  volume_base_km numeric,
  volume_pico_km numeric,
  prova_nome text,
  prova_data date,
  prova_distancia_km numeric,
  params_geracao jsonb,
  status text NOT NULL DEFAULT 'rascunho',
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrida_macrociclos_aluno ON public.corrida_macrociclos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_corrida_microciclos_macro ON public.corrida_microciclos(macrociclo_id);

ALTER TABLE public.corrida_macrociclos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read corrida_macrociclos" ON public.corrida_macrociclos
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert corrida_macrociclos" ON public.corrida_macrociclos
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update corrida_macrociclos" ON public.corrida_macrociclos
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete corrida_macrociclos" ON public.corrida_macrociclos
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER tg_set_atualizado_em_corrida_macrociclos
  BEFORE UPDATE ON public.corrida_macrociclos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
