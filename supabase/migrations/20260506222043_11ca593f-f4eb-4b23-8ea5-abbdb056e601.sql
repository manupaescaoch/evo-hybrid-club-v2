
-- Tabela de credenciais do aluno
CREATE TABLE public.alunos_acesso (
  aluno_id uuid PRIMARY KEY,
  senha_hash text NOT NULL,
  deve_trocar_senha boolean NOT NULL DEFAULT true,
  ultimo_login_em timestamp with time zone,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.alunos_acesso ENABLE ROW LEVEL SECURITY;

-- Equipe pode ver/criar/atualizar acesso
CREATE POLICY "crm read alunos_acesso" ON public.alunos_acesso
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));

CREATE POLICY "equipe insert alunos_acesso" ON public.alunos_acesso
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "equipe update alunos_acesso" ON public.alunos_acesso
  FOR UPDATE TO authenticated
  USING (is_equipe_or_admin(auth.uid()))
  WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin delete alunos_acesso" ON public.alunos_acesso
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_alunos_acesso_updated
  BEFORE UPDATE ON public.alunos_acesso
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
