
-- 1) Enum + coluna 'tipo' em conversas_mensagens
DO $$ BEGIN
  CREATE TYPE public.conversa_mensagem_tipo AS ENUM ('mensagem','nota_interna');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.conversas_mensagens
  ADD COLUMN IF NOT EXISTS tipo public.conversa_mensagem_tipo NOT NULL DEFAULT 'mensagem';

-- 2) Atualiza trigger de estado para ignorar notas internas
CREATE OR REPLACE FUNCTION public.tg_conversas_atualizar_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo = 'nota_interna' THEN
    RETURN NEW;
  END IF;

  UPDATE public.conversas_estado
     SET ultima_mensagem_texto = LEFT(NEW.texto, 200),
         ultima_mensagem_em = NEW.criado_em,
         ultima_direcao = NEW.direcao,
         nao_lidas_total = CASE
           WHEN NEW.direcao = 'in' THEN nao_lidas_total + 1
           ELSE nao_lidas_total
         END,
         status = CASE
           WHEN NEW.direcao = 'in' AND status = 'respondido' THEN 'aguardando'::conversa_status
           WHEN NEW.direcao = 'in' AND status IS NULL THEN 'aguardando'::conversa_status
           ELSE status
         END,
         atualizado_em = now()
   WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$function$;

-- 3) Tabela de eventos
DO $$ BEGIN
  CREATE TYPE public.conversa_evento_tipo AS ENUM (
    'status_alterado',
    'etiqueta_alterada',
    'atribuicao_alterada',
    'nota_adicionada',
    'mensagem_enviada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.conversas_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id uuid NOT NULL,
  usuario_id uuid,
  tipo public.conversa_evento_tipo NOT NULL,
  de jsonb,
  para jsonb,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversas_eventos_conv ON public.conversas_eventos (conversa_id, criado_em DESC);

ALTER TABLE public.conversas_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm read conversas_eventos" ON public.conversas_eventos;
CREATE POLICY "crm read conversas_eventos"
  ON public.conversas_eventos FOR SELECT
  TO authenticated
  USING (public.is_crm_user(auth.uid()));

DROP POLICY IF EXISTS "equipe insert conversas_eventos" ON public.conversas_eventos;
CREATE POLICY "equipe insert conversas_eventos"
  ON public.conversas_eventos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

DROP POLICY IF EXISTS "service_role all conversas_eventos" ON public.conversas_eventos;
CREATE POLICY "service_role all conversas_eventos"
  ON public.conversas_eventos FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4) Trigger de auditoria em conversas_estado
CREATE OR REPLACE FUNCTION public.tg_conversas_estado_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.conversas_eventos (conversa_id, usuario_id, tipo, de, para)
    VALUES (NEW.id, v_user, 'status_alterado',
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status));
  END IF;

  IF NEW.etiqueta IS DISTINCT FROM OLD.etiqueta THEN
    INSERT INTO public.conversas_eventos (conversa_id, usuario_id, tipo, de, para)
    VALUES (NEW.id, v_user, 'etiqueta_alterada',
            jsonb_build_object('etiqueta', OLD.etiqueta),
            jsonb_build_object('etiqueta', NEW.etiqueta));
  END IF;

  IF NEW.atribuido_a IS DISTINCT FROM OLD.atribuido_a THEN
    INSERT INTO public.conversas_eventos (conversa_id, usuario_id, tipo, de, para)
    VALUES (NEW.id, v_user, 'atribuicao_alterada',
            jsonb_build_object('atribuido_a', OLD.atribuido_a),
            jsonb_build_object('atribuido_a', NEW.atribuido_a));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversas_estado_auditoria ON public.conversas_estado;
CREATE TRIGGER trg_conversas_estado_auditoria
  AFTER UPDATE ON public.conversas_estado
  FOR EACH ROW EXECUTE FUNCTION public.tg_conversas_estado_auditoria();

-- 5) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas_eventos;
ALTER TABLE public.conversas_eventos REPLICA IDENTITY FULL;
