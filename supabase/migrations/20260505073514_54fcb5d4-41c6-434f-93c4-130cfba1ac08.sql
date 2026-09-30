
-- Revoga EXECUTE de funções internas (não devem ser chamadas via API pública)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buscar_aluno_por_telefone(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agendar_jobs_apos_entrega(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pos_anamnese() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pos_resposta_feedback() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_criar_entrega_dia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_agendar_apos_entrega() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_entrega_completa() FROM PUBLIC, anon, authenticated;
