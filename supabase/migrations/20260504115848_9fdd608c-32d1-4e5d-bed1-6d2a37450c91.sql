UPDATE public.workflow_config
SET valor = E'Fala comigo {nome}!\n\nChegou seu feedback quinzenal.\n\nQuero saber como foi a execução desses primeiros 15 dias: treino, dieta, rotina e dificuldades.\n\nSem maquiar resposta. Quanto mais claro você for, melhor fica o próximo ajuste.\n\nPreenche aqui 👇🏻\n\n{link}',
    atualizado_em = now()
WHERE chave = 'MSG_LINK_QUINZENAL';

UPDATE public.workflow_config
SET valor = E'Fala, comigo {nome}!\n\nChegou seu feedback mensal.\n\nQuero ver como foi sua execução nesse mês: treino, dieta, rotina, evolução e onde ainda está travando.\n\nResponde sem frescura. Quanto mais claro for o feedback, melhor fica o próximo ajuste.\n\nPreenche aqui 👇🏻\n\n{link}',
    atualizado_em = now()
WHERE chave = 'MSG_LINK_MENSAL';

UPDATE public.workflow_config
SET valor = 'https://mpteam-app.com/feedback-quinzenal', atualizado_em = now()
WHERE chave = 'FORM_URL_QUINZENAL';

UPDATE public.workflow_config
SET valor = 'https://mpteam-app.com/feedback-mensal', atualizado_em = now()
WHERE chave = 'FORM_URL_MENSAL';