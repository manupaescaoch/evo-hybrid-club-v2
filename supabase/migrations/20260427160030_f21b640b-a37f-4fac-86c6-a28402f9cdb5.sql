-- 1) Deletar jobs pendentes de anamnese de todos os alunos atuais em aguardando_anamnese
DELETE FROM public.jobs_disparos
WHERE executado = false
  AND tipo::text IN ('link_anamnese', 'lembrete_anamnese', 'anamnese_confirmacao', 'boas_vindas')
  AND aluno_id IN (
    SELECT id FROM public.alunos WHERE status = 'aguardando_anamnese'
  );

-- 2) Registrar histórico de mudança de status
INSERT INTO public.historico_status (aluno_id, status_de, status_para, alterado_por)
SELECT id, status::text, 'anamnese_recebida', 'sistema (dispensa em massa)'
FROM public.alunos
WHERE status = 'aguardando_anamnese';

-- 3) Avançar status para anamnese_recebida (dispara trg_criar_entrega_dia)
UPDATE public.alunos
SET status = 'anamnese_recebida',
    data_anamnese = COALESCE(data_anamnese, now()),
    atualizado_em = now()
WHERE status = 'aguardando_anamnese';