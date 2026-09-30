-- =============================================================
-- 1) Endurecer SECURITY DEFINER: revogar EXECUTE de anon/authenticated
-- nas funções internas usadas apenas por triggers/service_role.
-- =============================================================
REVOKE EXECUTE ON FUNCTION public.agendar_jobs_apos_entrega(uuid, timestamptz) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_agendar_apos_entrega() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_criar_entrega_dia() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_entrega_completa() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_pos_anamnese() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_pos_resposta_feedback() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_set_atualizado_em() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.calcular_data_limite_entrega(date) FROM anon, authenticated, public;

-- Mantém acessíveis para o app (nada a fazer; já são executáveis por padrão):
--   has_role, is_admin, is_crm_user, is_equipe_or_admin, buscar_aluno_por_telefone

-- =============================================================
-- 2) entregas_dia_log: INSERT apenas service_role
-- (triggers SECURITY DEFINER continuam inserindo via owner postgres)
-- =============================================================
DROP POLICY IF EXISTS "anyone insert entregas_dia_log" ON public.entregas_dia_log;

CREATE POLICY "service_role insert entregas_dia_log"
  ON public.entregas_dia_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================================
-- 3) Bucket anamnese-uploads: deixar privado
-- - remove leitura pública (qualquer URL direta com token continua válida via signed URL)
-- - mantém upload público (anon) para o formulário de anamnese
-- - mantém leitura/escrita/delete pela equipe
-- =============================================================
UPDATE storage.buckets SET public = false WHERE id = 'anamnese-uploads';

DROP POLICY IF EXISTS "anamnese public read" ON storage.objects;

-- Equipe lê (já existe update/delete, mas faltava SELECT explícito agora que não é público)
DROP POLICY IF EXISTS "anamnese equipe read" ON storage.objects;
CREATE POLICY "anamnese equipe read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'anamnese-uploads' AND public.is_equipe_or_admin(auth.uid()));