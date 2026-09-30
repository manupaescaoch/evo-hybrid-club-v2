
-- Enums
CREATE TYPE public.conversa_status AS ENUM ('aguardando', 'respondido', 'urgente');
CREATE TYPE public.conversa_etiqueta AS ENUM ('mpteam', 'mp_elite', 'mp_presencial');
CREATE TYPE public.conversa_direcao AS ENUM ('in', 'out');
CREATE TYPE public.conversa_envio_status AS ENUM ('pendente', 'enviado', 'erro', 'entregue', 'lida');

-- conversas_estado
CREATE TABLE public.conversas_estado (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  telefone text NOT NULL UNIQUE,
  ultima_mensagem_texto text,
  ultima_mensagem_em timestamptz,
  ultima_direcao public.conversa_direcao,
  status public.conversa_status NOT NULL DEFAULT 'aguardando',
  etiqueta public.conversa_etiqueta,
  atribuido_a uuid,
  nao_lidas_total integer NOT NULL DEFAULT 0,
  digitando_por uuid,
  digitando_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversas_estado_ultima ON public.conversas_estado(ultima_mensagem_em DESC);
CREATE INDEX idx_conversas_estado_aluno ON public.conversas_estado(aluno_id);
CREATE INDEX idx_conversas_estado_status ON public.conversas_estado(status);
CREATE INDEX idx_conversas_estado_atribuido ON public.conversas_estado(atribuido_a);

CREATE TRIGGER trg_conversas_estado_updated
  BEFORE UPDATE ON public.conversas_estado
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- conversas_mensagens
CREATE TABLE public.conversas_mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id uuid NOT NULL REFERENCES public.conversas_estado(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  direcao public.conversa_direcao NOT NULL,
  texto text NOT NULL,
  enviado_por uuid,
  zapi_message_id text,
  status_envio public.conversa_envio_status NOT NULL DEFAULT 'enviado',
  erro_detalhe text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversas_mensagens_conv ON public.conversas_mensagens(conversa_id, criado_em DESC);
CREATE INDEX idx_conversas_mensagens_aluno ON public.conversas_mensagens(aluno_id);
CREATE UNIQUE INDEX idx_conversas_mensagens_zapi ON public.conversas_mensagens(zapi_message_id) WHERE zapi_message_id IS NOT NULL;

-- conversas_leituras
CREATE TABLE public.conversas_leituras (
  conversa_id uuid NOT NULL REFERENCES public.conversas_estado(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  lida_ate_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversa_id, usuario_id)
);

-- Trigger: ao inserir mensagem, atualiza estado da conversa
CREATE OR REPLACE FUNCTION public.tg_conversas_atualizar_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

CREATE TRIGGER trg_conversas_msg_atualiza_estado
  AFTER INSERT ON public.conversas_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_conversas_atualizar_estado();

-- RLS
ALTER TABLE public.conversas_estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas_leituras ENABLE ROW LEVEL SECURITY;

-- conversas_estado policies
CREATE POLICY "crm read conversas_estado" ON public.conversas_estado
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert conversas_estado" ON public.conversas_estado
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update conversas_estado" ON public.conversas_estado
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete conversas_estado" ON public.conversas_estado
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "service_role all conversas_estado" ON public.conversas_estado
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- conversas_mensagens policies
CREATE POLICY "crm read conversas_mensagens" ON public.conversas_mensagens
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert conversas_mensagens" ON public.conversas_mensagens
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update conversas_mensagens" ON public.conversas_mensagens
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete conversas_mensagens" ON public.conversas_mensagens
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "service_role all conversas_mensagens" ON public.conversas_mensagens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- conversas_leituras policies (cada user gerencia as suas)
CREATE POLICY "crm read leituras" ON public.conversas_leituras
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "user insert own leitura" ON public.conversas_leituras
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "user update own leitura" ON public.conversas_leituras
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "user delete own leitura" ON public.conversas_leituras
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas_estado;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas_leituras;

ALTER TABLE public.conversas_estado REPLICA IDENTITY FULL;
ALTER TABLE public.conversas_mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.conversas_leituras REPLICA IDENTITY FULL;
