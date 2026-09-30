CREATE TABLE IF NOT EXISTS public.agente_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem integer NOT NULL DEFAULT 0,
  nome text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('treino','dieta','equipe','interno','ignorado','treino_dieta')),
  quando_usar text NOT NULL DEFAULT '',
  texto text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  publico_alvo text NOT NULL DEFAULT 'aluno' CHECK (publico_alvo IN ('aluno','interno','nenhum')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text
);

ALTER TABLE public.agente_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read agente_respostas" ON public.agente_respostas
  FOR SELECT TO authenticated USING (is_crm_user(auth.uid()));

CREATE POLICY "admin write agente_respostas" ON public.agente_respostas
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_agente_respostas_updated
BEFORE UPDATE ON public.agente_respostas
FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

INSERT INTO public.agente_respostas (ordem, nome, categoria, publico_alvo, quando_usar, texto) VALUES
(1, 'Perguntar quantidade do alimento', 'dieta', 'aluno', 'Quando o aluno perguntar se pode trocar um alimento, mas não informar a quantidade em gramas.', 'Pode, mas preciso saber a quantidade certinha. Quantas gramas tem no seu plano?'),
(2, 'Identificar se é troca de alimento ou refeição', 'dieta', 'aluno', 'Quando não estiver claro se o aluno quer trocar apenas um alimento ou a refeição inteira.', 'Consigo te ajudar, mas preciso saber certinho: você quer trocar só esse alimento ou a refeição toda? Me manda também a quantidade em gramas que aparece no seu plano.'),
(3, 'Troca simples de proteína', 'dieta', 'aluno', 'Quando o aluno informar a quantidade de proteína e pedir uma substituição simples.', E'Pode trocar por uma proteína equivalente.\n\n{quantidade} de {alimento} pronto fica mais ou menos próximo de:\n\n1. {opção_1}\n2. {opção_2}\n3. {opção_3}\n4. {opção_4}\n5. {opção_5}\n\nSó cuidado: troca por troca não é sempre igual, porque muda gordura e calorias.'),
(4, 'Exemplo de troca de 160g de frango', 'dieta', 'aluno', 'Quando o aluno perguntar especificamente sobre trocar 160g de frango.', E'Pode trocar por uma proteína equivalente.\n\n160g de frango pronto fica mais ou menos próximo de:\n\n1. 160g de peixe magro\n2. 150g de patinho moído\n3. 150g de carne magra\n4. 4 ovos inteiros + 3 claras\n5. 1 lata de atum em água + 2 ovos\n6. 180g de tilápia\n7. 150g de peito de peru ou frango desfiado\n\nSó cuidado: troca por troca não é sempre igual, porque muda gordura e calorias.'),
(5, 'Troca de refeição inteira', 'dieta', 'aluno', 'Quando o aluno pedir para trocar almoço, jantar, café da manhã, lanche ou a refeição inteira.', 'Dá pra adaptar, mas preciso saber o que tem nessa refeição e o que você quer trocar. Me manda a refeição completa do plano com as quantidades.'),
(6, 'Refeição completa enviada pelo aluno', 'dieta', 'aluno', 'Quando o aluno mandar uma refeição completa e pedir substituição.', E'Dá pra trocar mantendo a mesma lógica da refeição.\n\nProteína troca por proteína parecida.\nCarboidrato troca por uma fonte parecida.\nVegetais mantém.\n\nMas se for pra mudar a refeição inteira com frequência, aí precisa passar pela equipe pra não sair do plano.'),
(7, 'Aluno pulou refeição', 'dieta', 'aluno', 'Quando o aluno disser que pulou, atrasou ou perdeu uma refeição.', E'Não tenta compensar fazendo bagunça depois. Volta pra próxima refeição do plano e segue normal.\n\nO erro maior é transformar um deslize em efeito dominó.'),
(8, 'Refeição livre', 'dieta', 'aluno', 'Quando o aluno perguntar se pode fazer refeição livre.', E'Se a refeição livre estiver prevista no seu plano, segue como foi orientado.\n\nSe não estiver, melhor não encaixar por conta própria pra não bagunçar a estratégia.'),
(9, 'Suplemento fora do plano', 'dieta', 'aluno', 'Quando o aluno perguntar sobre um suplemento que não aparece no plano dele.', 'Esse suplemento não está no seu plano. Antes de usar, precisa passar pela equipe pra ver se faz sentido pro seu objetivo.'),
(10, 'Dúvida simples de execução', 'treino', 'aluno', 'Quando o aluno pedir orientação simples sobre execução de exercício.', E'Faz assim: reduz um pouco a carga, controla mais a descida e mantém a execução limpa.\n\nSe perder postura, a carga está alta demais. Primeiro domina o movimento, depois progride.'),
(11, 'Progressão de carga', 'treino', 'aluno', 'Quando o aluno perguntar quando ou como aumentar carga.', E'Aumenta carga quando conseguir fazer todas as repetições com boa execução e sem roubar movimento.\n\nSe subiu a carga e perdeu técnica, volta um pouco. Carga boa é carga que você controla.'),
(12, 'Substituição por falta de equipamento', 'treino', 'aluno', 'Quando o aluno não tiver acesso ao aparelho ou exercício do plano.', E'Dá pra substituir, mas preciso saber qual exercício está no seu plano e quais opções você tem aí na academia.\n\nMe manda isso que eu te digo a troca mais parecida.'),
(13, 'Dor leve no exercício', 'treino', 'aluno', 'Quando o aluno relatar desconforto leve durante algum exercício.', E'Reduz a carga e ajusta a execução primeiro.\n\nSe mesmo assim continuar incomodando, não força. Me avisa que eu vejo uma substituição mais segura pra você.'),
(14, 'Dor persistente ou lesão', 'equipe', 'aluno', 'Quando o aluno relatar dor persistente, lesão, inchaço, limitação de movimento ou diagnóstico médico.', E'Dor que continua mesmo ajustando carga e execução precisa de atenção.\n\nNão força esse exercício agora. Vou olhar isso com mais cuidado pra não te orientar no chute.'),
(15, 'Ajuste de plano', 'equipe', 'aluno', 'Quando o aluno pedir mudança de dieta, treino, macros, quantidades ou refeição.', E'Isso já muda o plano, então não dá pra ajustar de qualquer jeito por aqui.\n\nPreciso olhar com mais calma pra te orientar certo.'),
(16, 'Análise individual', 'equipe', 'aluno', 'Quando a dúvida depender de avaliação mais individual.', E'Isso precisa ser visto com mais atenção.\n\nPreciso olhar o contexto completo pra não te orientar no chute.'),
(17, 'Sem acesso ao plano do aluno', 'equipe', 'aluno', 'Quando não for possível localizar o plano ativo, treino ou dieta do aluno.', E'Preciso confirmar seu plano antes de te orientar com segurança.\n\nMe manda o que aparece no seu treino ou dieta pra eu ver certinho.'),
(18, 'Fora do escopo', 'ignorado', 'nenhum', 'Quando o aluno perguntar algo que não seja sobre treino ou dieta.', 'Não responder. Não enviar mensagem automática. Não dizer que vai passar para equipe. Não orientar para outro canal. Não explicar o motivo. Não gerar resposta para o aluno. Apenas ignorar a mensagem.'),
(19, 'Dúvida incompleta', 'treino_dieta', 'aluno', 'Quando faltar informação para responder com segurança.', E'Me manda mais uma informação pra eu te responder certo.\n\nQual exercício/refeição você está falando e o que aparece no seu plano?'),
(20, 'Aluno querendo trocar várias coisas', 'equipe', 'aluno', 'Quando o aluno quiser trocar vários alimentos, várias refeições ou mudar boa parte da dieta.', E'Aí já vira ajuste de dieta, não só uma troca simples.\n\nPreciso olhar isso com mais calma pra não bagunçar o plano.'),
(21, 'Aluno querendo novo treino', 'equipe', 'aluno', 'Quando o aluno pedir troca completa de treino ou novo treino.', E'Novo treino precisa ser ajustado com cuidado, porque muda a estrutura do planejamento.\n\nNão dá pra trocar no chute.'),
(22, 'Aluno pergunta se pode compensar dieta', 'dieta', 'aluno', 'Quando o aluno quiser compensar exagero, refeição perdida ou erro na dieta.', E'Não compensa fazendo mais bagunça.\n\nVolta pro plano na próxima refeição e segue normal. O que manda é o padrão da semana.'),
(23, 'Dúvida sobre horário de treino e refeição', 'dieta', 'aluno', 'Quando o aluno mudar o horário do treino e perguntar como fazer com a refeição.', E'Mantém a lógica do plano: refeição mais próxima antes do treino e depois volta pra sequência normal.\n\nSe essa mudança de horário virar rotina, aí precisa ajustar com mais cuidado.'),
(24, 'Espelho no grupo interno', 'interno', 'interno', 'Toda vez que uma resposta for enviada ao aluno dentro do horário permitido.', E'[DÚVIDA - ALUNO: {nome_aluno}]\n\nPergunta:\n{resumo_duvida}\n\nCategoria:\n{categoria}\n\nResposta enviada:\n{resposta_enviada}'),
(25, 'Registro interno de análise individual', 'interno', 'interno', 'Quando uma dúvida precisar de atenção individual e não puder ser respondida automaticamente.', E'[DÚVIDA PARA ANÁLISE - ALUNO: {nome_aluno}]\n\nDúvida:\n{resumo_duvida}\n\nMotivo:\n{motivo_analise}'),
(26, 'Mensagem ignorada fora do horário', 'interno', 'interno', 'Apenas para registro interno do sistema, sem envio ao aluno e sem envio ao grupo.', E'Mensagem recebida fora do horário permitido.\n\nAluno: {nome_aluno}\nHorário recebido: {data_hora}\nStatus: Ignorado fora do horário'),
(27, 'Mensagem ignorada fora do escopo', 'interno', 'interno', 'Apenas para registro interno do sistema, quando a mensagem não for sobre treino ou dieta.', E'Mensagem ignorada por estar fora do escopo.\n\nAluno: {nome_aluno}\nMensagem: {mensagem_recebida}\nStatus: Ignorado fora do escopo')
ON CONFLICT DO NOTHING;