
-- Enable unaccent extension for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- Immutable wrapper so we can use it in indexes / generated columns
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = public
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1)
$$;

-- Add normalized column (lowercase, no accents) maintained by trigger
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS name_normalized text;

CREATE OR REPLACE FUNCTION public.tg_foods_set_name_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name_normalized := lower(public.immutable_unaccent(coalesce(NEW.name, '')));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_foods_set_name_normalized ON public.foods;
CREATE TRIGGER trg_foods_set_name_normalized
BEFORE INSERT OR UPDATE OF name ON public.foods
FOR EACH ROW
EXECUTE FUNCTION public.tg_foods_set_name_normalized();

-- Backfill existing rows
UPDATE public.foods
SET name_normalized = lower(public.immutable_unaccent(coalesce(name, '')))
WHERE name_normalized IS NULL OR name_normalized <> lower(public.immutable_unaccent(coalesce(name, '')));

-- Indexes: trigram for fuzzy + btree for prefix
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE INDEX IF NOT EXISTS idx_foods_name_normalized_trgm
  ON public.foods USING gin (name_normalized public.gin_trgm_ops);
