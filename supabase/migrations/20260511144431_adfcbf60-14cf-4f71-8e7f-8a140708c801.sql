
CREATE TABLE IF NOT EXISTS public.agente_config (
  id boolean PRIMARY KEY DEFAULT true,
  nome text NOT NULL DEFAULT 'Agente de Dúvidas MPTEAM',
  ativo boolean NOT NULL DEFAULT true,
  hora_inicio smallint NOT NULL DEFAULT 5,
  hora_fim smallint NOT NULL DEFAULT 20,
  dias_semana smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6]::smallint[],
  canais text[] NOT NULL DEFAULT ARRAY['whatsapp','app','grupo_interno']::text[],
  modo_resposta text NOT NULL DEFAULT 'manu_paes',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text,
  CONSTRAINT agente_config_singleton CHECK (id = true)
);

ALTER TABLE public.agente_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read agente_config" ON public.agente_config
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));

CREATE POLICY "admin write agente_config" ON public.agente_config
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.agente_config (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.agente_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('respondido','escalado','ignorado_horario','ignorado_inativo','teste')),
  canal text,
  pergunta text,
  resposta text,
  motivo text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_referencia date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agente_logs_data_tipo_idx
  ON public.agente_logs (data_referencia, tipo);
CREATE INDEX IF NOT EXISTS agente_logs_aluno_idx
  ON public.agente_logs (aluno_id);

ALTER TABLE public.agente_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read agente_logs" ON public.agente_logs
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));

CREATE POLICY "equipe write agente_logs" ON public.agente_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "service_role insert agente_logs" ON public.agente_logs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "admin delete agente_logs" ON public.agente_logs
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
