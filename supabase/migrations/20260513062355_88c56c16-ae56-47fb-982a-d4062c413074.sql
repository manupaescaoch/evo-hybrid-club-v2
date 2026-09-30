
CREATE TABLE IF NOT EXISTS public.aluno_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aluno_push_subs_aluno ON public.aluno_push_subscriptions(aluno_id);

ALTER TABLE public.aluno_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- App do aluno usa supabaseAdmin via server fn (sessão própria), não auth.uid().
-- Bloqueia acesso direto via PostgREST e libera apenas equipe/admin do CRM.
CREATE POLICY "Equipe/admin podem ler subs"
  ON public.aluno_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "Equipe/admin podem gerenciar subs"
  ON public.aluno_push_subscriptions
  FOR ALL
  TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()))
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE TRIGGER tg_aluno_push_subs_updated
  BEFORE UPDATE ON public.aluno_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
