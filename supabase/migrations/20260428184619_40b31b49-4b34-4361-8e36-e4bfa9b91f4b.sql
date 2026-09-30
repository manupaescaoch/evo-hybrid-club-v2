-- =====================================================
-- system_logs
-- =====================================================
CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  module text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  description text,
  aluno_id uuid,
  aluno_nome text,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  stack_trace text,
  status text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX idx_system_logs_event_type ON public.system_logs(event_type);
CREATE INDEX idx_system_logs_severity ON public.system_logs(severity);
CREATE INDEX idx_system_logs_resolved ON public.system_logs(resolved);
CREATE INDEX idx_system_logs_aluno_id ON public.system_logs(aluno_id);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read system_logs" ON public.system_logs
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));

CREATE POLICY "equipe insert system_logs" ON public.system_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "service_role insert system_logs" ON public.system_logs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "equipe update system_logs" ON public.system_logs
  FOR UPDATE TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()))
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin delete system_logs" ON public.system_logs
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER tg_system_logs_updated
  BEFORE UPDATE ON public.system_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================
-- photo_audit_logs
-- =====================================================
CREATE TABLE public.photo_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid,
  aluno_nome text,
  formulario_id uuid,
  photo_type text,
  source text,
  original_url text,
  signed_url text,
  url_status text NOT NULL DEFAULT 'pendente'
    CHECK (url_status IN ('ativa','expirada','sem_assinatura','rejeitada','erro_403','erro_404','invalida','pendente')),
  error_reason text,
  last_sign_attempt_at timestamptz,
  sign_attempts integer NOT NULL DEFAULT 0,
  needs_resign boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_audit_created_at ON public.photo_audit_logs(created_at DESC);
CREATE INDEX idx_photo_audit_aluno_id ON public.photo_audit_logs(aluno_id);
CREATE INDEX idx_photo_audit_url_status ON public.photo_audit_logs(url_status);
CREATE INDEX idx_photo_audit_needs_resign ON public.photo_audit_logs(needs_resign);
CREATE INDEX idx_photo_audit_resolved ON public.photo_audit_logs(resolved);
CREATE UNIQUE INDEX idx_photo_audit_unique_url ON public.photo_audit_logs(formulario_id, original_url) WHERE formulario_id IS NOT NULL;

ALTER TABLE public.photo_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read photo_audit_logs" ON public.photo_audit_logs
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));

CREATE POLICY "equipe insert photo_audit_logs" ON public.photo_audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "service_role insert photo_audit_logs" ON public.photo_audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "equipe update photo_audit_logs" ON public.photo_audit_logs
  FOR UPDATE TO authenticated
  USING (public.is_equipe_or_admin(auth.uid()))
  WITH CHECK (public.is_equipe_or_admin(auth.uid()));

CREATE POLICY "admin delete photo_audit_logs" ON public.photo_audit_logs
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER tg_photo_audit_logs_updated
  BEFORE UPDATE ON public.photo_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();