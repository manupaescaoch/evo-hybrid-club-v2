ALTER TABLE public.daily_checkins REPLICA IDENTITY FULL;
ALTER TABLE public.feedback_envios REPLICA IDENTITY FULL;
ALTER TABLE public.transacoes REPLICA IDENTITY FULL;
ALTER TABLE public.entregas_dia REPLICA IDENTITY FULL;
ALTER TABLE public.alunos REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_envios; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transacoes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.entregas_dia; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.alunos; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;