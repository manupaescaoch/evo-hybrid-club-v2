-- Tabela de transações financeiras
CREATE TABLE public.transacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id    uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('receita','estorno','ajuste')),
  origem      text NOT NULL CHECK (origem IN ('kiwify','manual')),
  valor       numeric(10,2) NOT NULL,
  descricao   text,
  referencia  text,
  competencia date NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  criado_por  text
);

CREATE INDEX idx_transacoes_competencia ON public.transacoes(competencia);
CREATE INDEX idx_transacoes_aluno_id ON public.transacoes(aluno_id);
CREATE INDEX idx_transacoes_tipo ON public.transacoes(tipo);
CREATE INDEX idx_transacoes_origem ON public.transacoes(origem);

ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read transacoes"
  ON public.transacoes FOR SELECT TO authenticated
  USING (public.is_crm_user(auth.uid()));

CREATE POLICY "equipe insert transacoes"
  ON public.transacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin update transacoes"
  ON public.transacoes FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete transacoes"
  ON public.transacoes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));