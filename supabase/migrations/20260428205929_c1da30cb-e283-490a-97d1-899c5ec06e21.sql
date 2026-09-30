CREATE POLICY "public insert aluno via anamnese authenticated"
ON public.alunos
FOR INSERT
TO authenticated
WITH CHECK (origem = 'anamnese');