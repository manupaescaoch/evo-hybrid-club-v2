CREATE TABLE IF NOT EXISTS public.financeiro_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  cor text NOT NULL DEFAULT '#6B7280',
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read categorias" ON public.financeiro_categorias
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "admin write categorias" ON public.financeiro_categorias
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.financeiro_categorias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_transacao date,
  ADD COLUMN IF NOT EXISTS fitid text,
  ADD COLUMN IF NOT EXISTS banco text;

CREATE UNIQUE INDEX IF NOT EXISTS transacoes_fitid_banco_uniq
  ON public.transacoes (fitid, banco) WHERE fitid IS NOT NULL;

INSERT INTO public.financeiro_categorias (nome, tipo, cor) VALUES
  ('Mensalidade Alunos', 'receita', '#16A34A'),
  ('Vendas Avulsas', 'receita', '#10B981'),
  ('Outras Receitas', 'receita', '#22C55E'),
  ('Fornecedores', 'despesa', '#DC2626'),
  ('Folha de Pagamento', 'despesa', '#B91C1C'),
  ('Marketing', 'despesa', '#F59E0B'),
  ('Aluguel', 'despesa', '#EA580C'),
  ('Impostos', 'despesa', '#7C2D12'),
  ('Software/Serviços', 'despesa', '#9333EA'),
  ('Outras Despesas', 'despesa', '#6B7280')
ON CONFLICT (nome) DO NOTHING;