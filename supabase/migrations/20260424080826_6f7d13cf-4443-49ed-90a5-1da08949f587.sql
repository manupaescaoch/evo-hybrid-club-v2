-- Bucket público para uploads da anamnese (exames + fotos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('anamnese-uploads', 'anamnese-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública
CREATE POLICY "anamnese public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'anamnese-uploads');

-- Upload anônimo (formulário público sem login)
CREATE POLICY "anamnese anon insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'anamnese-uploads');

-- Update/Delete somente equipe ou admin
CREATE POLICY "anamnese crm update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'anamnese-uploads' AND public.is_equipe_or_admin(auth.uid()))
WITH CHECK (bucket_id = 'anamnese-uploads' AND public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "anamnese crm delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'anamnese-uploads' AND public.is_equipe_or_admin(auth.uid()));