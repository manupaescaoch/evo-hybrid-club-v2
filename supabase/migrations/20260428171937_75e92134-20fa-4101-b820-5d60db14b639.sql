-- Tabela principal de avaliações físicas
CREATE TABLE public.physical_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  evaluator_id UUID,
  evaluator_name TEXT,
  assessment_type TEXT NOT NULL DEFAULT 'inicial',
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  height NUMERIC,
  weight NUMERIC,
  bmi NUMERIC,
  body_fat_percentage NUMERIC,
  lean_mass_percentage NUMERIC,
  fat_mass_kg NUMERIC,
  lean_mass_kg NUMERIC,
  skinfold_sum NUMERIC,
  waist_hip_ratio NUMERIC,
  arm_muscle_area NUMERIC,
  arm_fat_area NUMERIC,
  protocolo_dobras TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_physical_assessments_student ON public.physical_assessments(student_id);
CREATE INDEX idx_physical_assessments_date ON public.physical_assessments(assessment_date DESC);

ALTER TABLE public.physical_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read assessments" ON public.physical_assessments
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert assessments" ON public.physical_assessments
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update assessments" ON public.physical_assessments
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete assessments" ON public.physical_assessments
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_physical_assessments_updated
  BEFORE UPDATE ON public.physical_assessments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Circunferências
CREATE TABLE public.body_circumferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL UNIQUE REFERENCES public.physical_assessments(id) ON DELETE CASCADE,
  shoulder NUMERIC,
  waist NUMERIC,
  abdomen NUMERIC,
  hip NUMERIC,
  right_thigh NUMERIC,
  left_thigh NUMERIC,
  right_calf NUMERIC,
  left_calf NUMERIC,
  relaxed_right_arm NUMERIC,
  relaxed_left_arm NUMERIC,
  contracted_right_arm NUMERIC,
  contracted_left_arm NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.body_circumferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read circumferences" ON public.body_circumferences
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert circumferences" ON public.body_circumferences
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update circumferences" ON public.body_circumferences
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete circumferences" ON public.body_circumferences
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_body_circumferences_updated
  BEFORE UPDATE ON public.body_circumferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Dobras cutâneas
CREATE TABLE public.skinfold_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL UNIQUE REFERENCES public.physical_assessments(id) ON DELETE CASCADE,
  biceps NUMERIC,
  triceps NUMERIC,
  subscapular NUMERIC,
  suprailiac NUMERIC,
  abdominal NUMERIC,
  midaxillary NUMERIC,
  chest NUMERIC,
  thigh NUMERIC,
  medial_calf NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.skinfold_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read skinfolds" ON public.skinfold_measurements
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));
CREATE POLICY "equipe insert skinfolds" ON public.skinfold_measurements
  FOR INSERT TO authenticated WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "equipe update skinfolds" ON public.skinfold_measurements
  FOR UPDATE TO authenticated USING (is_equipe_or_admin(auth.uid())) WITH CHECK (is_equipe_or_admin(auth.uid()));
CREATE POLICY "admin delete skinfolds" ON public.skinfold_measurements
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_skinfold_measurements_updated
  BEFORE UPDATE ON public.skinfold_measurements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();