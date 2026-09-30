
-- Revoke EXECUTE from anon/public on all SECURITY DEFINER functions in public schema

-- Role check helpers: keep available to authenticated (used inside RLS), block anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_crm_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_equipe_or_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_crm_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_equipe_or_admin(uuid) TO authenticated;

-- Trigger functions previously executable by PUBLIC/anon: revoke
REVOKE EXECUTE ON FUNCTION public.tg_conversas_atualizar_estado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_conversas_estado_auditoria() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_formularios_vincular_por_telefone() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recalc_score_agua() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recalc_score_checkin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_agendar_apos_entrega() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_criar_entrega_dia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_entrega_completa() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pos_anamnese() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pos_resposta_feedback() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Internal helpers: callable only by server-side roles
REVOKE EXECUTE ON FUNCTION public.agendar_jobs_apos_entrega(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buscar_aluno_por_telefone(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_score_dia(uuid, date) FROM PUBLIC, anon, authenticated;
