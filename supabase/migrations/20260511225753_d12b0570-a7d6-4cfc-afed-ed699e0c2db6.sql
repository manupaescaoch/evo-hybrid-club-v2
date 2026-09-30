-- Anon não pode mais inserir em alunos diretamente.
-- Inserções via anamnese pública passam por criarAlunoPublico (server fn com service role).
DROP POLICY IF EXISTS "public insert aluno via anamnese" ON public.alunos;
DROP POLICY IF EXISTS "public insert aluno via anamnese authenticated" ON public.alunos;