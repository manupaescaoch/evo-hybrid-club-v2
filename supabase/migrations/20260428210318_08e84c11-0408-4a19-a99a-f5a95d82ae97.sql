CREATE POLICY "public insert system_logs anamnese"
ON public.system_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (module IN ('anamnese_publica','feedback_publico'));