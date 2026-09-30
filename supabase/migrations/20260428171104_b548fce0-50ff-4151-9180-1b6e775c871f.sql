-- Permite UPSERT (upload com upsert=true) por anon/authenticated no bucket anamnese-uploads.
-- O cliente Supabase Storage precisa de permissão de UPDATE quando o objeto já existe.
CREATE POLICY "anamnese anon update"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'anamnese-uploads'::text)
WITH CHECK (bucket_id = 'anamnese-uploads'::text);