
-- 1) Perfil de corrida do aluno
CREATE TABLE public.corrida_perfil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL UNIQUE,
  fc_max integer,
  fc_repouso integer,
  pace_limiar_seg integer, -- pace em segundos por km (ex: 5:00 = 300)
  vdot numeric(5,2),
  nivel text, -- 'iniciante' | 'intermediario' | 'avancado'
  volume_semanal_km numeric(6,2),
  experiencia_anos numeric(4,1),
  historico_lesoes text,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corrida_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read corrida_perfil" ON public.corrida_perfil
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert corrida_perfil" ON public.corrida_perfil
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update corrida_perfil" ON public.corrida_perfil
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete corrida_perfil" ON public.corrida_perfil
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER tg_corrida_perfil_touch BEFORE UPDATE ON public.corrida_perfil
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();


-- 2) Microciclo (semana)
CREATE TABLE public.corrida_microciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  data_inicio date NOT NULL, -- sempre uma segunda-feira
  numero_semana integer,
  tipo_semana text NOT NULL DEFAULT 'normal', -- 'forte' | 'regenerativa' | 'choque' | 'polimento' | 'normal'
  volume_alvo_km numeric(6,2),
  intensidade_alvo_pct integer, -- % de tempo em Z3+
  objetivo text,
  observacao text,
  status text NOT NULL DEFAULT 'rascunho', -- 'rascunho' | 'publicada'
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, data_inicio)
);

CREATE INDEX idx_corrida_microciclos_aluno ON public.corrida_microciclos(aluno_id, data_inicio DESC);

ALTER TABLE public.corrida_microciclos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read corrida_microciclos" ON public.corrida_microciclos
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert corrida_microciclos" ON public.corrida_microciclos
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update corrida_microciclos" ON public.corrida_microciclos
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete corrida_microciclos" ON public.corrida_microciclos
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER tg_corrida_microciclos_touch BEFORE UPDATE ON public.corrida_microciclos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();


-- 3) Sessões do dia
CREATE TABLE public.corrida_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  microciclo_id uuid NOT NULL REFERENCES public.corrida_microciclos(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL,
  data date NOT NULL,
  ordem_no_dia integer NOT NULL DEFAULT 0,
  tipo text NOT NULL, -- 'longao' | 'regenerativo' | 'intervalado' | 'tempo' | 'fartlek' | 'strides' | 'forca' | 'mobilidade' | 'cross' | 'descanso'
  nome text NOT NULL,
  duracao_min integer,
  distancia_km numeric(6,2),
  pace_alvo text,
  zona_fc text,
  objetivo text,
  observacao text,
  executada boolean NOT NULL DEFAULT false,
  executado_em timestamptz,
  executado_tempo_min integer,
  executado_distancia_km numeric(6,2),
  executado_pse integer,
  executado_observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_corrida_sessoes_micro ON public.corrida_sessoes(microciclo_id, data, ordem_no_dia);
CREATE INDEX idx_corrida_sessoes_aluno_data ON public.corrida_sessoes(aluno_id, data);

ALTER TABLE public.corrida_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read corrida_sessoes" ON public.corrida_sessoes
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert corrida_sessoes" ON public.corrida_sessoes
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update corrida_sessoes" ON public.corrida_sessoes
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete corrida_sessoes" ON public.corrida_sessoes
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER tg_corrida_sessoes_touch BEFORE UPDATE ON public.corrida_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();


-- 4) Blocos internos da sessão
CREATE TABLE public.corrida_sessao_blocos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.corrida_sessoes(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  tipo text NOT NULL, -- 'aquecimento' | 'rodagem' | 'intervalado' | 'strides' | 'tempo' | 'desaquecimento' | 'forca'
  nome text NOT NULL,
  descricao text,
  duracao_min text,
  pace text,
  zona text,
  series text,
  distancia_serie text,
  recuperacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_corrida_sessao_blocos_sessao ON public.corrida_sessao_blocos(sessao_id, ordem);

ALTER TABLE public.corrida_sessao_blocos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read corrida_sessao_blocos" ON public.corrida_sessao_blocos
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert corrida_sessao_blocos" ON public.corrida_sessao_blocos
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update corrida_sessao_blocos" ON public.corrida_sessao_blocos
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete corrida_sessao_blocos" ON public.corrida_sessao_blocos
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));


-- 5) Biblioteca de modelos de sessão
CREATE TABLE public.corrida_modelos_sessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL,
  descricao text,
  objetivo text,
  duracao_min integer,
  distancia_km numeric(6,2),
  pace_alvo text,
  zona_fc text,
  blocos jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  publico boolean NOT NULL DEFAULT true,
  criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_corrida_modelos_sessao_tipo ON public.corrida_modelos_sessao(tipo);

ALTER TABLE public.corrida_modelos_sessao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read corrida_modelos_sessao" ON public.corrida_modelos_sessao
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert corrida_modelos_sessao" ON public.corrida_modelos_sessao
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update corrida_modelos_sessao" ON public.corrida_modelos_sessao
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete corrida_modelos_sessao" ON public.corrida_modelos_sessao
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER tg_corrida_modelos_sessao_touch BEFORE UPDATE ON public.corrida_modelos_sessao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
