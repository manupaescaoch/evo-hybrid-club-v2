
-- Função: snap para a próxima janela 8h-20h em dia útil (BRT)
CREATE OR REPLACE FUNCTION public.next_brt_business_window(base timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  local_ts timestamp;
  local_date date;
  local_time time;
  dow int;
  result_ts timestamp;
BEGIN
  local_ts := base AT TIME ZONE 'America/Sao_Paulo';
  local_date := local_ts::date;
  local_time := local_ts::time;
  dow := EXTRACT(ISODOW FROM local_date); -- 1=Mon..7=Sun

  -- Fim de semana: avança para segunda 8h
  IF dow = 6 THEN
    local_date := local_date + INTERVAL '2 days';
    local_time := time '08:00';
  ELSIF dow = 7 THEN
    local_date := local_date + INTERVAL '1 day';
    local_time := time '08:00';
  ELSE
    -- Dia útil
    IF local_time < time '08:00' THEN
      local_time := time '08:00';
    ELSIF local_time >= time '20:00' THEN
      -- Após 20h: próximo dia útil às 8h
      local_date := local_date + INTERVAL '1 day';
      dow := EXTRACT(ISODOW FROM local_date);
      IF dow = 6 THEN local_date := local_date + INTERVAL '2 days';
      ELSIF dow = 7 THEN local_date := local_date + INTERVAL '1 day';
      END IF;
      local_time := time '08:00';
    END IF;
  END IF;

  result_ts := (local_date + local_time)::timestamp;
  RETURN result_ts AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

-- Atualiza trigger para usar janela 8-20h em vez de fixar 8h
CREATE OR REPLACE FUNCTION public.jobs_disparos_normalizar_horario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Tipos enviados imediatamente (sem normalização)
  IF NEW.tipo IN (
    'anamnese_confirmacao',
    'anamnese_recebida',
    'ia_check_shape',
    'ia_feedback_quinzenal',
    'aniversario'
  ) THEN
    RETURN NEW;
  END IF;

  -- Tipos que devem cair em janela 8h-20h dia útil BRT
  IF NEW.tipo IN (
    'feedback_quinzenal_resposta',
    'feedback_mensal_resposta',
    'pos_feedback_mensal',
    'followup_d7',
    'followup_d21',
    'feedback_quinzenal_link',
    'feedback_mensal_link'
  ) THEN
    IF NEW.agendado_para IS NOT NULL THEN
      NEW.agendado_para := public.next_brt_business_window(NEW.agendado_para);
    END IF;
    RETURN NEW;
  END IF;

  -- Demais tipos (legado): mantém comportamento antigo
  IF NEW.agendado_para IS NOT NULL THEN
    NEW.agendado_para := public.next_brt_8am(NEW.agendado_para);
  END IF;
  RETURN NEW;
END;
$$;

-- Reagenda jobs pendentes desses tipos para a próxima janela válida
UPDATE public.jobs_disparos
SET agendado_para = public.next_brt_business_window(agendado_para)
WHERE executado = false
  AND tipo IN (
    'feedback_quinzenal_resposta',
    'feedback_mensal_resposta',
    'pos_feedback_mensal',
    'followup_d7',
    'followup_d21',
    'feedback_quinzenal_link',
    'feedback_mensal_link'
  );
