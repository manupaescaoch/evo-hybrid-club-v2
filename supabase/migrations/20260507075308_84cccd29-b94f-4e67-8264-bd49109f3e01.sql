
-- 1) Username do aluno
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS alunos_username_key
  ON public.alunos (lower(username)) WHERE username IS NOT NULL;

-- 2) Posts da comunidade
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  foto_url text NOT NULL,
  legenda text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_posts_created_idx
  ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_aluno_idx
  ON public.community_posts (aluno_id, created_at DESC);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read community_posts"
  ON public.community_posts FOR SELECT
  USING (public.is_crm_user(auth.uid()));

CREATE POLICY "crm write community_posts"
  ON public.community_posts FOR ALL
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

-- 3) Curtidas
CREATE TABLE IF NOT EXISTS public.community_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, aluno_id)
);
CREATE INDEX IF NOT EXISTS community_likes_aluno_idx
  ON public.community_likes (aluno_id);

ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read community_likes"
  ON public.community_likes FOR SELECT
  USING (public.is_crm_user(auth.uid()));

CREATE POLICY "crm write community_likes"
  ON public.community_likes FOR ALL
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

-- 4) Realtime
ALTER TABLE public.community_posts REPLICA IDENTITY FULL;
ALTER TABLE public.community_likes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_likes;
