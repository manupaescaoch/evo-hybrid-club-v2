-- 0025: remover SELECT amplo no bucket público whatsapp-midia.
-- O bucket continua público (acesso direto por URL conhecida), mas listagem em massa é bloqueada.
DROP POLICY IF EXISTS "whatsapp_midia_public_read" ON storage.objects;

-- Restringir INSERT/UPDATE apenas a CRM/equipe (antes qualquer authenticated podia subir).
DROP POLICY IF EXISTS "whatsapp_midia_auth_insert" ON storage.objects;
CREATE POLICY "whatsapp_midia_crm_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-midia' AND public.is_equipe_or_admin(auth.uid()));

DROP POLICY IF EXISTS "whatsapp_midia_auth_update" ON storage.objects;
CREATE POLICY "whatsapp_midia_crm_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'whatsapp-midia' AND public.is_equipe_or_admin(auth.uid()))
WITH CHECK (bucket_id = 'whatsapp-midia' AND public.is_equipe_or_admin(auth.uid()));