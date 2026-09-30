-- ============ FOODS ============
CREATE TABLE public.foods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  source TEXT,
  kcal_100g NUMERIC NOT NULL DEFAULT 0,
  protein_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_100g NUMERIC NOT NULL DEFAULT 0,
  fat_100g NUMERIC NOT NULL DEFAULT 0,
  fiber_100g NUMERIC NOT NULL DEFAULT 0,
  is_fruit BOOLEAN NOT NULL DEFAULT false,
  created_by_user BOOLEAN NOT NULL DEFAULT false,
  original_subcategory TEXT,
  source_document TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX foods_name_source_unique ON public.foods (lower(name), coalesce(source,''));
CREATE INDEX foods_name_trgm ON public.foods USING GIN (name gin_trgm_ops);
CREATE INDEX foods_is_fruit_idx ON public.foods (is_fruit);

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read foods" ON public.foods FOR SELECT TO authenticated
  USING (public.is_crm_user(auth.uid()));
CREATE POLICY "equipe insert foods" ON public.foods FOR INSERT TO authenticated
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update foods" ON public.foods FOR UPDATE TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()))
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete foods" ON public.foods FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER foods_updated_at BEFORE UPDATE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- ============ FOOD MEASURES ============
CREATE TABLE public.food_measures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  measure_name TEXT NOT NULL,
  measure_type TEXT,
  grams_equivalent NUMERIC NOT NULL DEFAULT 1,
  display_dropdown TEXT,
  display_prescription TEXT,
  observation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX food_measures_food_id_idx ON public.food_measures (food_id, sort_order);

ALTER TABLE public.food_measures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read measures" ON public.food_measures FOR SELECT TO authenticated
  USING (public.is_crm_user(auth.uid()));
CREATE POLICY "equipe insert measures" ON public.food_measures FOR INSERT TO authenticated
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update measures" ON public.food_measures FOR UPDATE TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()))
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete measures" ON public.food_measures FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER food_measures_updated_at BEFORE UPDATE ON public.food_measures
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- ============ FRUIT PORTION OPTIONS ============
CREATE TABLE public.fruit_portion_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  food_name TEXT NOT NULL,
  grams NUMERIC NOT NULL,
  reference_kcal NUMERIC NOT NULL DEFAULT 76,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.fruit_portion_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read fruit_portion" ON public.fruit_portion_options FOR SELECT TO authenticated
  USING (public.is_crm_user(auth.uid()));
CREATE POLICY "admin write fruit_portion" ON public.fruit_portion_options FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ SOURCE REFERENCE ============
CREATE TABLE public.source_reference (
  source_name TEXT NOT NULL PRIMARY KEY,
  source_priority INTEGER NOT NULL DEFAULT 99,
  description TEXT,
  document TEXT,
  edition_or_version TEXT
);

ALTER TABLE public.source_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read source_reference" ON public.source_reference FOR SELECT TO authenticated
  USING (public.is_crm_user(auth.uid()));
CREATE POLICY "admin write source_reference" ON public.source_reference FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed prioridades
INSERT INTO public.source_reference (source_name, source_priority, description) VALUES
  ('TACO', 1, 'Tabela Brasileira de Composição de Alimentos'),
  ('TBCA', 2, 'Tabela Brasileira de Composição de Alimentos USP'),
  ('IBGE', 3, 'Tabela IBGE'),
  ('USDA', 4, 'United States Department of Agriculture'),
  ('Meus alimentos', 5, 'Alimentos cadastrados pelo usuário');