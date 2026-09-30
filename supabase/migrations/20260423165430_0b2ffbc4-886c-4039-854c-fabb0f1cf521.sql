-- Tabela de substitutos de itens de dieta
CREATE TABLE public.dieta_item_substitutos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.dieta_itens(id) ON DELETE CASCADE,
  alimento_id uuid REFERENCES public.alimentos(id) ON DELETE SET NULL,
  nome_custom text,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'g',
  kcal numeric NOT NULL DEFAULT 0,
  ptn numeric NOT NULL DEFAULT 0,
  cho numeric NOT NULL DEFAULT 0,
  lip numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dieta_item_substitutos_item_id ON public.dieta_item_substitutos(item_id);

ALTER TABLE public.dieta_item_substitutos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read substitutos" ON public.dieta_item_substitutos
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));

CREATE POLICY "equipe insert substitutos" ON public.dieta_item_substitutos
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "equipe update substitutos" ON public.dieta_item_substitutos
  FOR UPDATE TO authenticated
  USING (is_equipe_or_admin(auth.uid()))
  WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "equipe delete substitutos" ON public.dieta_item_substitutos
  FOR DELETE TO authenticated USING (is_equipe_or_admin(auth.uid()));


-- Tabela de favoritos do nutricionista
CREATE TABLE public.alimento_favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  principal jsonb NOT NULL,
  substitutos jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alimento_favoritos_user_id ON public.alimento_favoritos(user_id);

ALTER TABLE public.alimento_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own favoritos" ON public.alimento_favoritos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users insert own favoritos" ON public.alimento_favoritos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own favoritos" ON public.alimento_favoritos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own favoritos" ON public.alimento_favoritos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);