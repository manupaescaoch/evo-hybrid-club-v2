-- Enriquecer tabela alimentos
ALTER TABLE public.alimentos
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS subcategoria text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fibra_100 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS restricoes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fonte text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regiao text DEFAULT 'BR';

-- Garantir extensão pg_trgm (já está em uso pelo show_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice trigram para busca por nome (similaridade)
CREATE INDEX IF NOT EXISTS idx_alimentos_nome_trgm
  ON public.alimentos USING gin (nome gin_trgm_ops);

-- Índice GIN para busca em aliases
CREATE INDEX IF NOT EXISTS idx_alimentos_aliases_gin
  ON public.alimentos USING gin (aliases);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_alimentos_categoria ON public.alimentos (categoria) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_alimentos_tags_gin ON public.alimentos USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_alimentos_restricoes_gin ON public.alimentos USING gin (restricoes);