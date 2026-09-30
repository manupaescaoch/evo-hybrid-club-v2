CREATE OR REPLACE FUNCTION public.alunos_nome_uppercase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS NOT NULL THEN
    NEW.nome := upper(NEW.nome);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alunos_nome_uppercase ON public.alunos;
CREATE TRIGGER trg_alunos_nome_uppercase
BEFORE INSERT OR UPDATE OF nome ON public.alunos
FOR EACH ROW
EXECUTE FUNCTION public.alunos_nome_uppercase();

UPDATE public.alunos SET nome = upper(nome) WHERE nome IS NOT NULL AND nome <> upper(nome);