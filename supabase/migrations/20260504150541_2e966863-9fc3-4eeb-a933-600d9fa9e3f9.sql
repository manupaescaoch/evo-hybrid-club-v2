-- Adiciona disparo dos triggers também em INSERT (formulários públicos chegam já respondidos)
DROP TRIGGER IF EXISTS trg_pos_resposta_feedback_ins ON public.formularios;
CREATE TRIGGER trg_pos_resposta_feedback_ins
AFTER INSERT ON public.formularios
FOR EACH ROW EXECUTE FUNCTION public.trg_pos_resposta_feedback();

DROP TRIGGER IF EXISTS trg_pos_anamnese_ins ON public.formularios;
CREATE TRIGGER trg_pos_anamnese_ins
AFTER INSERT ON public.formularios
FOR EACH ROW EXECUTE FUNCTION public.trg_pos_anamnese();