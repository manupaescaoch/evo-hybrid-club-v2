
CREATE TABLE public.workflow_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text UNIQUE NOT NULL,
  valor text,
  tipo text NOT NULL CHECK (tipo IN ('boolean','integer','text','time')),
  secao text NOT NULL CHECK (secao IN ('motor','ciclo','mensagens')),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

ALTER TABLE public.workflow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read workflow_config" ON public.workflow_config
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));

CREATE POLICY "admin write workflow_config" ON public.workflow_config
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER tg_workflow_config_updated
  BEFORE UPDATE ON public.workflow_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

INSERT INTO public.workflow_config (chave, valor, tipo, secao) VALUES
  ('MOTOR_ATIVO', 'true', 'boolean', 'motor'),
  ('DIA_FOLLOWUP_1', '7', 'integer', 'ciclo'),
  ('DIA_FEEDBACK_QUINZENAL', '15', 'integer', 'ciclo'),
  ('DIA_FOLLOWUP_2', '21', 'integer', 'ciclo'),
  ('DIA_FEEDBACK_MENSAL', '30', 'integer', 'ciclo'),
  ('DELAY_RESPOSTA_HORAS', '2', 'integer', 'ciclo'),
  ('JOB_HORARIO', '08:00', 'time', 'ciclo'),
  ('MSG_LINK_QUINZENAL', 'Olá {nome}! Hora do seu feedback quinzenal. Responda aqui: {link}', 'text', 'mensagens'),
  ('MSG_LINK_MENSAL', 'Olá {nome}! Hora do seu feedback mensal (check shape). Responda aqui: {link}', 'text', 'mensagens'),
  ('MSG_AVISO_NOVO_PLANO', 'Olá {nome}! Seu novo planejamento já está disponível. Bora pra cima! 🔥', 'text', 'mensagens'),
  ('MSG_CONFIRMACAO_ANAMNESE', '', 'text', 'mensagens');

INSERT INTO public.prompts_ia (tipo, prompt_sistema, ativo)
SELECT 'anamnese'::prompt_tipo, 'Você é um assistente que analisa anamneses iniciais de alunos de consultoria de nutrição e performance. Resuma os pontos mais relevantes em até 5 bullets curtos e objetivos.', true
WHERE NOT EXISTS (SELECT 1 FROM public.prompts_ia WHERE tipo = 'anamnese');

INSERT INTO public.prompts_ia (tipo, prompt_sistema, ativo)
SELECT 'feedback_quinzenal'::prompt_tipo, 'Você é um treinador respondendo o feedback quinzenal de {{nome_aluno}}. Seja direto, motivador e prescreva 1-2 ajustes claros para os próximos 15 dias.', true
WHERE NOT EXISTS (SELECT 1 FROM public.prompts_ia WHERE tipo = 'feedback_quinzenal');

INSERT INTO public.prompts_ia (tipo, prompt_sistema, ativo)
SELECT 'feedback_mensal'::prompt_tipo, 'Você é um treinador respondendo o feedback mensal (check shape) de {{nome_aluno}}. Foque em evolução do mês e ajustes para o próximo ciclo.', true
WHERE NOT EXISTS (SELECT 1 FROM public.prompts_ia WHERE tipo = 'feedback_mensal');

INSERT INTO public.prompts_ia (tipo, prompt_sistema, ativo)
SELECT 'followup_d7'::prompt_tipo, 'Escreva uma mensagem curta e calorosa de WhatsApp para o aluno {{nome_aluno}} no 7º dia do plano. Pergunte como está, motive e ofereça ajuda.', true
WHERE NOT EXISTS (SELECT 1 FROM public.prompts_ia WHERE tipo = 'followup_d7');

INSERT INTO public.prompts_ia (tipo, prompt_sistema, ativo)
SELECT 'followup_d21'::prompt_tipo, 'Escreva uma mensagem curta de WhatsApp para o aluno {{nome_aluno}} no 21º dia do plano. Reforce o foco na reta final do ciclo e cobre constância.', true
WHERE NOT EXISTS (SELECT 1 FROM public.prompts_ia WHERE tipo = 'followup_d21');
