-- Adiciona coluna origem para distinguir respostas públicas das tokenizadas
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'token';

-- Permite que anônimos criem linha de formulário público (sem aluno vinculado)
DROP POLICY IF EXISTS "public insert formularios publicos" ON public.formularios;
CREATE POLICY "public insert formularios publicos"
ON public.formularios
FOR INSERT
TO anon, authenticated
WITH CHECK (origem = 'publico' AND aluno_id IS NULL AND respondido = false);
