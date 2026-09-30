
ALTER TABLE public.conversas_mensagens
  ADD COLUMN IF NOT EXISTS midia_tipo text,
  ADD COLUMN IF NOT EXISTS midia_url text,
  ADD COLUMN IF NOT EXISTS midia_mime text,
  ADD COLUMN IF NOT EXISTS midia_nome text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-midia', 'whatsapp-midia', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "whatsapp_midia_public_read" ON storage.objects;
CREATE POLICY "whatsapp_midia_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-midia');

DROP POLICY IF EXISTS "whatsapp_midia_auth_insert" ON storage.objects;
CREATE POLICY "whatsapp_midia_auth_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-midia');

DROP POLICY IF EXISTS "whatsapp_midia_auth_update" ON storage.objects;
CREATE POLICY "whatsapp_midia_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'whatsapp-midia');
