CREATE OR REPLACE FUNCTION public.tg_formularios_vincular_por_telefone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tel text;
  v_aluno uuid;
  v_nome text;
  v_email text;
  v_peso text;
  v_peso_num numeric;
BEGIN
  IF NEW.aluno_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.respondido IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_tel := regexp_replace(
    coalesce(
      NEW.dados_resposta->'dados_pessoais'->>'telefone',
      NEW.dados_resposta->'identificacao'->>'telefone',
      NEW.dados_resposta->'data'->'dados_pessoais'->>'telefone',
      NEW.dados_resposta->'data'->'identificacao'->>'telefone',
      NEW.dados_resposta->>'telefone',
      ''
    ), '\D', '', 'g'
  );

  IF length(v_tel) < 8 THEN
    RETURN NEW;
  END IF;

  SELECT a.id INTO v_aluno
  FROM public.alunos a
  WHERE regexp_replace(a.whatsapp, '\D', '', 'g') = v_tel
  LIMIT 1;

  IF v_aluno IS NOT NULL THEN
    NEW.aluno_id := v_aluno;
    RETURN NEW;
  END IF;

  v_nome := nullif(btrim(coalesce(
    NEW.dados_resposta->'dados_pessoais'->>'nome',
    NEW.dados_resposta->'identificacao'->>'nome_completo',
    NEW.dados_resposta->'identificacao'->>'nome',
    NEW.dados_resposta->'data'->'dados_pessoais'->>'nome',
    NEW.dados_resposta->'data'->'identificacao'->>'nome_completo',
    NEW.dados_resposta->'data'->'identificacao'->>'nome',
    NEW.dados_resposta->>'nome',
    ''
  )), '');

  IF v_nome IS NULL THEN
    RETURN NEW;
  END IF;

  v_email := nullif(btrim(coalesce(
    NEW.dados_resposta->'dados_pessoais'->>'email',
    NEW.dados_resposta->'data'->'dados_pessoais'->>'email',
    NEW.dados_resposta->>'email',
    ''
  )), '');

  v_peso := nullif(replace(coalesce(
    NEW.dados_resposta->'dados_pessoais'->>'peso',
    NEW.dados_resposta->'identificacao'->>'peso_atual_kg',
    NEW.dados_resposta->'identificacao'->>'peso_kg',
    NEW.dados_resposta->'data'->'dados_pessoais'->>'peso',
    NEW.dados_resposta->'data'->'identificacao'->>'peso_atual_kg',
    NEW.dados_resposta->'data'->'identificacao'->>'peso_kg',
    ''
  ), ',', '.'), '');

  IF v_peso ~ '^\d+(\.\d{1,2})?$' THEN
    v_peso_num := v_peso::numeric;
  END IF;

  INSERT INTO public.alunos (nome, whatsapp, email, origem, peso_kg)
  VALUES (v_nome, v_tel, v_email, 'formulario_publico', v_peso_num)
  RETURNING id INTO v_aluno;

  NEW.aluno_id := v_aluno;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_formularios_vincular_por_telefone_ins ON public.formularios;
DROP TRIGGER IF EXISTS trg_formularios_vincular_por_telefone_upd ON public.formularios;

CREATE TRIGGER trg_formularios_vincular_por_telefone_ins
BEFORE INSERT ON public.formularios
FOR EACH ROW
EXECUTE FUNCTION public.tg_formularios_vincular_por_telefone();

CREATE TRIGGER trg_formularios_vincular_por_telefone_upd
BEFORE UPDATE OF respondido, dados_resposta, aluno_id ON public.formularios
FOR EACH ROW
EXECUTE FUNCTION public.tg_formularios_vincular_por_telefone();

REVOKE EXECUTE ON FUNCTION public.tg_formularios_vincular_por_telefone() FROM PUBLIC, anon, authenticated;