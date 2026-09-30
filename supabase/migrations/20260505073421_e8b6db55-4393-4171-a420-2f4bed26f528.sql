
CREATE OR REPLACE FUNCTION public.next_brt_8am(base timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$
  SELECT
    CASE
      WHEN (base AT TIME ZONE 'America/Sao_Paulo')::time <= '08:00:00'
      THEN ((base AT TIME ZONE 'America/Sao_Paulo')::date + time '08:00') AT TIME ZONE 'America/Sao_Paulo'
      ELSE ((base AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day' + time '08:00') AT TIME ZONE 'America/Sao_Paulo'
    END
$function$;

CREATE OR REPLACE FUNCTION public.jobs_disparos_normalizar_horario()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.tipo IN (
    'ia_check_shape',
    'ia_feedback_quinzenal',
    'feedback_quinzenal_resposta',
    'feedback_mensal_resposta',
    'aniversario'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.agendado_para IS NOT NULL THEN
    NEW.agendado_para := public.next_brt_8am(NEW.agendado_para);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_trgm') THEN
    EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='unaccent') THEN
    EXECUTE 'ALTER EXTENSION unaccent SET SCHEMA extensions';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path = public, extensions
AS $function$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$function$;

DROP POLICY IF EXISTS "public update formularios" ON public.formularios;
CREATE POLICY "public update formularios pendentes"
ON public.formularios
FOR UPDATE
TO anon, authenticated
USING (origem IN ('publico','token') AND respondido = false)
WITH CHECK (origem IN ('publico','token'));

DROP POLICY IF EXISTS "public update envios" ON public.feedback_envios;
CREATE POLICY "public update envios pendentes"
ON public.feedback_envios
FOR UPDATE
TO anon, authenticated
USING (status = 'pendente')
WITH CHECK (status IN ('pendente','respondido'));

DROP POLICY IF EXISTS "public insert historico" ON public.historico_status;
