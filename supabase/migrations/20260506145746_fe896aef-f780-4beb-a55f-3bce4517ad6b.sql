ALTER TABLE public.workflow_config DROP CONSTRAINT IF EXISTS workflow_config_secao_check;
ALTER TABLE public.workflow_config ADD CONSTRAINT workflow_config_secao_check
  CHECK (secao = ANY (ARRAY['motor'::text,'ciclo'::text,'mensagens'::text,'formularios'::text,'notificacoes_diarias'::text,'notificacoes_feedbacks'::text]));

INSERT INTO public.workflow_config(secao, chave, valor, tipo) VALUES
  ('notificacoes_feedbacks','RESPOSTAS_FEEDBACKS_ATIVO','false','boolean'),
  ('notificacoes_feedbacks','RESPOSTAS_FEEDBACKS_DESTINO_TIPO','grupo','text'),
  ('notificacoes_feedbacks','RESPOSTAS_FEEDBACKS_DESTINO_VALOR','','text')
ON CONFLICT (chave) DO NOTHING;