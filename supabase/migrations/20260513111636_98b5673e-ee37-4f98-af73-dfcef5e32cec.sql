-- 1) Remover tabelas sensíveis desnecessárias da publicação Realtime
-- Estas tabelas são consumidas via server functions / polling, não precisam de broadcast.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'daily_checkins',
    'feedback_envios',
    'aluno_agua_log',
    'aluno_refeicoes_log',
    'aluno_atividades_dia'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 2) Habilitar RLS em realtime.messages e restringir subscriptions a usuários CRM autenticados
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "crm users can subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_crm_user(auth.uid()));

DROP POLICY IF EXISTS "crm users can broadcast to realtime" ON realtime.messages;
CREATE POLICY "crm users can broadcast to realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_crm_user(auth.uid()));
