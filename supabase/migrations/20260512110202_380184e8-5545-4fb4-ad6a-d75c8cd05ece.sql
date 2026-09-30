CREATE TABLE IF NOT EXISTS public.respostas_rapidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  titulo text NOT NULL,
  texto text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_respostas_rapidas_cat ON public.respostas_rapidas(categoria, ordem);

ALTER TABLE public.respostas_rapidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read respostas_rapidas"
  ON public.respostas_rapidas FOR SELECT
  TO authenticated
  USING (public.is_crm_user(auth.uid()));

CREATE POLICY "crm write respostas_rapidas"
  ON public.respostas_rapidas FOR ALL
  TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE TRIGGER respostas_rapidas_set_atualizado_em
  BEFORE UPDATE ON public.respostas_rapidas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

INSERT INTO public.respostas_rapidas (categoria, titulo, texto, ordem) VALUES
  ('ONBOARD', 'Atualização', 'Olá! Tudo certo? Estou passando aqui para atualizar o status do seu protocolo. Em breve te chamo com novidades. 💪', 1),
  ('ONBOARD', 'Feedback quinzenal', 'Bora alinhar o seu feedback quinzenal? Me responde como estão sendo seus treinos, alimentação e energia nos últimos 15 dias.', 2),
  ('ONBOARD', 'Novo aluno', 'Seja muito bem-vindo(a) ao MPTEAM! 🚀 Já te enviei o material inicial. Qualquer dúvida, estou por aqui.', 3),
  ('NOVO LEAD', 'Apresentação', 'Oi! Aqui é da MPTEAM. Vi seu interesse em começar e estou à disposição para tirar suas dúvidas e te explicar como funciona.', 1),
  ('MP TEAM', 'Boas-vindas', 'Bem-vindo(a) ao MP TEAM! Seu acompanhamento começa agora. Em até 3 dias úteis seu treino e plano alimentar estarão prontos.', 1),
  ('APP MPTEAM', 'Mensagem 1', 'Ainda não baixou nosso app? Acesse o app MFIT e faça login com o e-mail cadastrado. A senha foi enviada por e-mail (confere o spam também).', 1)
ON CONFLICT DO NOTHING;