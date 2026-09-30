ALTER TABLE public.workflow_config DROP CONSTRAINT IF EXISTS workflow_config_secao_check;
ALTER TABLE public.workflow_config ADD CONSTRAINT workflow_config_secao_check
  CHECK (secao = ANY (ARRAY['motor'::text, 'ciclo'::text, 'mensagens'::text, 'formularios'::text, 'notificacoes_diarias'::text]));