-- Normalização canônica de telefone BR: remove tudo que não é dígito,
-- remove DDI 55 e o 9º dígito de celular para gerar uma chave de 10 dígitos
-- (DDD + 8 dígitos). Usada tanto para busca quanto para comparação.
CREATE OR REPLACE FUNCTION public.normalizar_telefone_br(_telefone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  d text;
BEGIN
  d := regexp_replace(coalesce(_telefone, ''), '\D', '', 'g');
  -- Remove DDI 55
  IF length(d) >= 12 AND left(d, 2) = '55' THEN
    d := substr(d, 3);
  END IF;
  -- Remove o 9º dígito de celular (após DDD) quando presente
  IF length(d) = 11 AND substr(d, 3, 1) = '9' THEN
    d := substr(d, 1, 2) || substr(d, 4);
  END IF;
  RETURN d;
END;
$$;

-- Reescreve buscar_aluno_por_telefone usando a forma canônica
CREATE OR REPLACE FUNCTION public.buscar_aluno_por_telefone(_telefone text)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.nome
  FROM public.alunos a
  WHERE length(public.normalizar_telefone_br(_telefone)) = 10
    AND public.normalizar_telefone_br(a.whatsapp)
        = public.normalizar_telefone_br(_telefone)
  ORDER BY a.criado_em DESC NULLS LAST
  LIMIT 1;
$$;