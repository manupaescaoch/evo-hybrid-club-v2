-- Tabela de comunicações automáticas enviadas ao aluno
CREATE TABLE public.comunicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  gatilho text NOT NULL,
  canal text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','falha','pendente')),
  mensagem text NOT NULL,
  enviado_em timestamp with time zone NOT NULL DEFAULT now(),
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX comunicacoes_aluno_enviado_idx
  ON public.comunicacoes (aluno_id, enviado_em DESC);

ALTER TABLE public.comunicacoes ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado do CRM
CREATE POLICY "crm read comunicacoes"
  ON public.comunicacoes
  FOR SELECT
  TO authenticated
  USING (public.is_crm_user(auth.uid()));

-- Inserção: equipe ou admin
CREATE POLICY "equipe insert comunicacoes"
  ON public.comunicacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

-- Atualização: equipe ou admin (atualizar status, por ex.)
CREATE POLICY "equipe update comunicacoes"
  ON public.comunicacoes
  FOR UPDATE
  TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()))
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

-- Exclusão: somente admin
CREATE POLICY "admin delete comunicacoes"
  ON public.comunicacoes
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));