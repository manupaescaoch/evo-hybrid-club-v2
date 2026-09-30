DROP POLICY IF EXISTS "crm write respostas_rapidas" ON public.respostas_rapidas;

CREATE POLICY "admin insert respostas_rapidas"
ON public.respostas_rapidas
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "admin update respostas_rapidas"
ON public.respostas_rapidas
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "admin delete respostas_rapidas"
ON public.respostas_rapidas
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));