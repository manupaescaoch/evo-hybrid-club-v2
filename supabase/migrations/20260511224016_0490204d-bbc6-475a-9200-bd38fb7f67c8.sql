
-- Remove políticas públicas em formularios
DROP POLICY IF EXISTS "public read formularios" ON public.formularios;
DROP POLICY IF EXISTS "public update formularios pendentes" ON public.formularios;
DROP POLICY IF EXISTS "public insert formularios publicos" ON public.formularios;

-- CRM precisa ler formulários (toda equipe)
CREATE POLICY "crm read formularios"
  ON public.formularios
  FOR SELECT
  TO authenticated
  USING (public.is_crm_user(auth.uid()));

-- Equipe pode atualizar formulários (vincular aluno, link público, etc.)
CREATE POLICY "equipe update formularios"
  ON public.formularios
  FOR UPDATE
  TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()))
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

-- Remove políticas públicas em feedback_envios
DROP POLICY IF EXISTS "public read envios" ON public.feedback_envios;
DROP POLICY IF EXISTS "public update envios pendentes" ON public.feedback_envios;
