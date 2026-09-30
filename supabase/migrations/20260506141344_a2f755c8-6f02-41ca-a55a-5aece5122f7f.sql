REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agendar_jobs_apos_entrega(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buscar_aluno_por_telefone(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_formularios_vincular_por_telefone() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_agendar_apos_entrega() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_criar_entrega_dia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_entrega_completa() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pos_anamnese() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pos_resposta_feedback() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_crm_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_equipe_or_admin(uuid) FROM PUBLIC, anon;