-- Extensão para busca textual
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) ALIMENTOS (banco compartilhado)
CREATE TABLE public.alimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  marca text,
  unidade_padrao text NOT NULL DEFAULT 'g',
  qtd_padrao numeric NOT NULL DEFAULT 100,
  kcal_100 numeric NOT NULL DEFAULT 0,
  ptn_100 numeric NOT NULL DEFAULT 0,
  cho_100 numeric NOT NULL DEFAULT 0,
  lip_100 numeric NOT NULL DEFAULT 0,
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alimentos_nome_trgm ON public.alimentos USING GIN (nome gin_trgm_ops);

ALTER TABLE public.alimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm read alimentos" ON public.alimentos FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert alimentos" ON public.alimentos FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update alimentos" ON public.alimentos FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete alimentos" ON public.alimentos FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- 2) DIETA_PLANOS
CREATE TABLE public.dieta_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Plano alimentar',
  status text NOT NULL DEFAULT 'rascunho',
  dias_semana text[] NOT NULL DEFAULT ARRAY['seg','ter','qua','qui','sex','sab','dom'],
  peso_referencia numeric,
  meta_kcal numeric,
  ptn_g_kg numeric,
  cho_g_kg numeric,
  lip_g_kg numeric,
  observacoes text,
  template boolean NOT NULL DEFAULT false,
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dieta_planos_aluno ON public.dieta_planos(aluno_id);
CREATE INDEX idx_dieta_planos_template ON public.dieta_planos(template) WHERE template = true;
CREATE TRIGGER trg_dieta_planos_atualizado_em BEFORE UPDATE ON public.dieta_planos FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

ALTER TABLE public.dieta_planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm read planos" ON public.dieta_planos FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert planos" ON public.dieta_planos FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update planos" ON public.dieta_planos FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete planos" ON public.dieta_planos FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- 3) DIETA_REFEICOES
CREATE TABLE public.dieta_refeicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.dieta_planos(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  nome text NOT NULL,
  horario text,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dieta_refeicoes_plano ON public.dieta_refeicoes(plano_id, ordem);

ALTER TABLE public.dieta_refeicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm read refeicoes" ON public.dieta_refeicoes FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert refeicoes" ON public.dieta_refeicoes FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update refeicoes" ON public.dieta_refeicoes FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe delete refeicoes" ON public.dieta_refeicoes FOR DELETE TO authenticated USING (is_equipe_or_admin(auth.uid()));

-- 4) DIETA_ITENS
CREATE TABLE public.dieta_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refeicao_id uuid NOT NULL REFERENCES public.dieta_refeicoes(id) ON DELETE CASCADE,
  alimento_id uuid REFERENCES public.alimentos(id) ON DELETE SET NULL,
  nome_custom text,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'g',
  kcal numeric NOT NULL DEFAULT 0,
  ptn numeric NOT NULL DEFAULT 0,
  cho numeric NOT NULL DEFAULT 0,
  lip numeric NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dieta_itens_refeicao ON public.dieta_itens(refeicao_id, ordem);

ALTER TABLE public.dieta_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm read itens" ON public.dieta_itens FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert itens" ON public.dieta_itens FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update itens" ON public.dieta_itens FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe delete itens" ON public.dieta_itens FOR DELETE TO authenticated USING (is_equipe_or_admin(auth.uid()));