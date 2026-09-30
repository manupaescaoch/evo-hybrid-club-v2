-- 1. feedback_templates
CREATE TABLE public.feedback_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'custom',
  perguntas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read templates" ON public.feedback_templates FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert templates" ON public.feedback_templates FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update templates" ON public.feedback_templates FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete templates" ON public.feedback_templates FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER tg_feedback_templates_atualizado BEFORE UPDATE ON public.feedback_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- 2. feedback_envios
CREATE TABLE public.feedback_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.feedback_templates(id) ON DELETE RESTRICT,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT (gen_random_uuid())::text,
  status text NOT NULL DEFAULT 'pendente',
  respostas jsonb,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz,
  expira_em timestamptz
);
ALTER TABLE public.feedback_envios ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_feedback_envios_aluno ON public.feedback_envios(aluno_id);
CREATE INDEX idx_feedback_envios_template ON public.feedback_envios(template_id);
CREATE INDEX idx_feedback_envios_status ON public.feedback_envios(status);

CREATE POLICY "crm read envios" ON public.feedback_envios FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert envios" ON public.feedback_envios FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update envios" ON public.feedback_envios FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete envios" ON public.feedback_envios FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "public read envios" ON public.feedback_envios FOR SELECT TO anon USING (true);
CREATE POLICY "public update envios" ON public.feedback_envios FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- 3. feedback_agendamentos
CREATE TABLE public.feedback_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.feedback_templates(id) ON DELETE RESTRICT,
  periodicidade text NOT NULL,
  intervalo_dias integer NOT NULL,
  proximo_envio_em timestamptz,
  ultimo_envio_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback_agendamentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_feedback_agendamentos_aluno ON public.feedback_agendamentos(aluno_id);
CREATE INDEX idx_feedback_agendamentos_proximo ON public.feedback_agendamentos(proximo_envio_em) WHERE ativo = true;

CREATE POLICY "crm read agendamentos" ON public.feedback_agendamentos FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe write agendamentos" ON public.feedback_agendamentos FOR ALL TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));

CREATE TRIGGER tg_feedback_agendamentos_atualizado BEFORE UPDATE ON public.feedback_agendamentos FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- 4. Seeds dos templates padrão
INSERT INTO public.feedback_templates (nome, descricao, tipo) VALUES
  ('Anamnese', 'Avaliação inicial do aluno: histórico, objetivos e condições de saúde', 'anamnese'),
  ('Feedback Quinzenal', 'Acompanhamento quinzenal: evolução física, treino, dieta e bem-estar', 'feedback_quinzenal'),
  ('Feedback Mensal', 'Avaliação mensal completa com fotos de evolução, peso e medidas', 'feedback_mensal');