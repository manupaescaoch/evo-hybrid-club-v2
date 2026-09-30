-- Remover acesso anônimo de upload/update no bucket anamnese-uploads.
-- Todos os uploads agora passam por server functions com service role
-- (via uploadAnamneseFile + signAnamneseUrls), portanto anon não precisa
-- mais inserir/sobrescrever objetos diretamente.
DROP POLICY IF EXISTS "anamnese anon insert" ON storage.objects;
DROP POLICY IF EXISTS "anamnese anon update" ON storage.objects;