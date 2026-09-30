-- Fix function search_path
CREATE OR REPLACE FUNCTION public.tg_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$function$;

-- Bloqueia listagem em massa do bucket público aluno-fotos.
-- Conteúdo continua servido pelo CDN público quando a URL é conhecida.
DROP POLICY IF EXISTS "public read aluno-fotos" ON storage.objects;