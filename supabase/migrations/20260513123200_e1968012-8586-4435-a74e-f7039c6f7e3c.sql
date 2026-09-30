
CREATE INDEX IF NOT EXISTS idx_daily_checkins_aluno_data ON public.daily_checkins(aluno_id, data_checkin DESC);
CREATE INDEX IF NOT EXISTS idx_aluno_agua_log_aluno_data ON public.aluno_agua_log(aluno_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_aluno_refeicoes_log_aluno_data ON public.aluno_refeicoes_log(aluno_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_aluno_atividades_dia_aluno_data ON public.aluno_atividades_dia(aluno_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_feedback_envios_aluno_enviado ON public.feedback_envios(aluno_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_entregas_dia_aluno_data ON public.entregas_dia(aluno_id, data_referencia DESC);
CREATE INDEX IF NOT EXISTS idx_physical_assessments_student_date ON public.physical_assessments(student_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_body_circumferences_assessment ON public.body_circumferences(assessment_id);
CREATE INDEX IF NOT EXISTS idx_dieta_planos_aluno_status ON public.dieta_planos(aluno_id, status, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_aluno_criado ON public.transacoes(aluno_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_aluno_enviado ON public.comunicacoes(aluno_id, enviado_em DESC);
