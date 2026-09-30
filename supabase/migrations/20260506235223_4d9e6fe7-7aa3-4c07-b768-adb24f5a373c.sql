CREATE OR REPLACE FUNCTION public.tg_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alunos_acesso_updated ON public.alunos_acesso;
CREATE TRIGGER trg_alunos_acesso_updated
BEFORE UPDATE ON public.alunos_acesso
FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();