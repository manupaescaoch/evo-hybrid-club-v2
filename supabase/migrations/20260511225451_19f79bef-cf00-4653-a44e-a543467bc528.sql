-- Revoga EXECUTE de papéis públicos em SECURITY DEFINER que não devem ser
-- chamados pela API. Funções de role (has_role, is_admin, is_crm_user,
-- is_equipe_or_admin) continuam disponíveis para `authenticated` porque
-- são usadas por RLS policies do CRM. Demais funções são revogadas para
-- todos os papéis expostos.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_crm_user(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_equipe_or_admin(uuid) FROM anon, public;

REVOKE EXECUTE ON FUNCTION public.agendar_jobs_apos_entrega(uuid, timestamptz) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.buscar_aluno_por_telefone(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalcular_score_dia(uuid, date) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Trigger functions: never chamadas via API
REVOKE EXECUTE ON FUNCTION public.tg_formularios_vincular_por_telefone() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_recalc_score_agua() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_recalc_score_checkin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_agendar_apos_entrega() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_criar_entrega_dia() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_entrega_completa() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_pos_anamnese() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_pos_resposta_feedback() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_set_atualizado_em() FROM anon, authenticated, public;