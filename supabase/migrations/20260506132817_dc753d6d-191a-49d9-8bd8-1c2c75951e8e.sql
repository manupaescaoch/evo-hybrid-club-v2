
-- Backfill: vincula formularios respondidos sem aluno usando o telefone
UPDATE public.formularios f
SET aluno_id = a.id
FROM public.alunos a
WHERE f.aluno_id IS NULL
  AND f.respondido = true
  AND f.tipo IN ('feedback_mensal','feedback_quinzenal','anamnese')
  AND length(regexp_replace(
        coalesce(
          f.dados_resposta->'identificacao'->>'telefone',
          f.dados_resposta->>'telefone',
          ''
        ),'\D','','g')) >= 8
  AND regexp_replace(a.whatsapp,'\D','','g') = regexp_replace(
        coalesce(
          f.dados_resposta->'identificacao'->>'telefone',
          f.dados_resposta->>'telefone',
          ''
        ),'\D','','g');

-- Função: tenta vincular formulario ao aluno pelo telefone das respostas
CREATE OR REPLACE FUNCTION public.tg_formularios_vincular_por_telefone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text;
  v_aluno uuid;
BEGIN
  IF NEW.aluno_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.respondido IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_tel := regexp_replace(
    coalesce(
      NEW.dados_resposta->'identificacao'->>'telefone',
      NEW.dados_resposta->>'telefone',
      ''
    ),'\D','','g');

  IF length(v_tel) < 8 THEN
    RETURN NEW;
  END IF;

  SELECT a.id INTO v_aluno
  FROM public.alunos a
  WHERE regexp_replace(a.whatsapp,'\D','','g') = v_tel
  LIMIT 1;

  IF v_aluno IS NOT NULL THEN
    NEW.aluno_id := v_aluno;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_formularios_vincular_por_telefone ON public.formularios;
CREATE TRIGGER trg_formularios_vincular_por_telefone
  BEFORE INSERT OR UPDATE OF respondido, dados_resposta ON public.formularios
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_formularios_vincular_por_telefone();
