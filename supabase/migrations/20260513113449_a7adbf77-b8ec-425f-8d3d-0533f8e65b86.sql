-- Remove INSERT direto em system_logs por anon/authenticated.
-- Logs públicos passam a ser gravados pela server function logarFalhaPublicaServer (service_role).
DROP POLICY IF EXISTS "public insert system_logs anamnese" ON public.system_logs;