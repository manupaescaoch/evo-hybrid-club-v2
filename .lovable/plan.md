## Objetivo

Transformar a prescrição de treino em fluxo rápido: 1 clique abre um **wizard de geração** onde você define tudo (escopo, dias, periodização, intensidade, zonas, esteira) e pré-visualiza antes de gerar. Depois de gerado, a edição é totalmente manual com **drag-and-drop entre dias** e o sheet lateral que já existe.

---

## 1. Botão "Gerar plano" + Wizard (pré-geração)

Na aba **Plano**, ao lado do "Salvar", adicionar botão primário **"⚡ Gerar"** que abre um `Sheet` lateral grande (`sm:max-w-2xl`) com wizard em **4 passos** (stepper no topo):

### Passo 1 — Escopo (o quê gerar)
Toggle group com 3 opções:
- **Só esta semana** (1 microciclo)
- **Bloco de 4 semanas** (mesociclo: 3 fortes + 1 regenerativa)
- **Macro até a prova** (precisa ter prova cadastrada; mostra: "16 semanas até Meia POA")

Quando macro/meso: campo "Semana inicial" (default = semana atual).

### Passo 2 — Dias e estrutura da semana
- **Dias de treino**: 7 toggles (SEG–DOM). Off = descanso.
- **Dia do longão**: select dos dias marcados (default: domingo se marcado, senão sábado).
- **Dias de qualidade**: select múltiplo (default: terça + quinta).
- **Dia de força** (opcional): select.
- Preview textual: `"5 dias/sem · Longão DOM · Qualidade TER+QUI · Off SEG+SEX"`.

### Passo 3 — Periodização e intensidade
- **Modelo de periodização**: radio cards (Linear, Polarizado 80/20, Piramidal, Reverso) com 1 linha de descrição cada.
- **Volume base** (km/sem) e **Volume pico** (km/sem) — para meso/macro o sistema progride entre os dois. Para "só esta semana", aparece só "Volume alvo".
- **Distribuição por dia** (tabela): para cada dia marcado, dropdown de **tipo** (longão/regenerativo/intervalado/tempo/fartlek/strides/força/cross) + dropdown de **zona alvo** (Z1–Z5, pré-preenchida pelo tipo). Você pode reordenar/trocar livremente.
- Validação leve: alerta se 3+ dias seguidos Z3+, ou se longão > 35% do volume.

### Passo 4 — Revisão e gerar
- Mostra tabela final: linha por semana × coluna por dia, com tipo + volume estimado + zona.
- Para macro/meso: mostra a curva de volume (gráfico simples) e onde caem as regenerativas/taper.
- Botão **"Gerar e abrir para edição"** (cria os microciclos + sessões no Supabase como rascunho e fecha o sheet, abrindo a primeira semana gerada).
- Botão secundário **"Voltar e ajustar"**.

> Nada é salvo até o passo 4. O wizard guarda estado em memória.

---

## 2. Edição pós-geração (drag-and-drop + sheet)

Na grade semanal já existente:

- **Cada card de sessão** vira draggable (lib `@dnd-kit/core`).
- **Cada coluna de dia** vira droppable. Soltar uma sessão num dia diferente atualiza `data` + recalcula `ordem_no_dia` da origem e do destino.
- Botão `…` no card (já no hover) ganha: **Duplicar**, **Mover para…**, **Excluir**, **Substituir por modelo da biblioteca**.
- Clique simples no card continua abrindo o **sheet lateral** existente (com blocos + zonas).
- Header da semana ganha botão **"⚡ Regerar esta semana"** (reabre o wizard pré-preenchido com os parâmetros usados; usuário confirma → substitui as sessões da semana).

---

## 3. Conversão pace ↔ velocidade de esteira (sempre visível)

### Lógica (`src/lib/corrida-zonas.ts`)
- `paceToKmh(pace: "5:30") → 10.91`
- `paceToEsteira(pace) → { kmh: "10,9 km/h", inclinacao: "1%" }` (1% é padrão de compensação outdoor↔indoor, configurável).

### Onde aparece
1. **Card de sessão** (grade): abaixo do pace, em fonte menor: `5:30/km · 10,9 km/h`.
2. **Sheet lateral — header da sessão**: `Pace alvo 5:30/km  ·  Esteira: 10,9 km/h @ 1%`.
3. **Cada bloco** (intervalado/tempo): coluna extra "Esteira" auto-calculada do pace.
4. **Wizard passo 3**: ao definir zona alvo do dia, mostra `Z3 · 5:30–5:50/km · 10,3–10,9 km/h`.
5. **Aba Perfil**: nova seção "Preview de zonas" passa a mostrar 3 colunas: Zona | Pace | km/h esteira.
6. **App do aluno** (`aluno.treino.tsx`): mesma exibição — pace e km/h lado a lado em toda sessão e bloco.

Toggle global de inclinação default (0%, 1%, 2%) na aba **Perfil**.

---

## 4. Banco de dados

Migration única — apenas aditiva, sem quebrar nada:

- **`corrida_microciclos`**: adicionar `params_geracao jsonb` (guarda o estado do wizard: escopo, dias, periodização, distribuição — usado pelo "Regerar").
- **`corrida_perfil`**: adicionar `inclinacao_esteira_pct integer default 1`.
- **`corrida_macrociclos`** (nova, simples): `id, aluno_id, nome, prova_id (nullable), data_inicio, data_fim, semanas_total, modelo_periodizacao, volume_base_km, volume_pico_km, params_geracao jsonb, status` — para vincular semanas geradas em lote.
- **`corrida_microciclos`**: adicionar `macrociclo_id uuid nullable` + `ordem_no_macro int nullable`.
- RLS no padrão das tabelas `corrida_*` existentes.

> Provas-alvo (`corrida_provas`) ficam para uma onda posterior — no MVP, "macro até a prova" pede que você digite a data-alvo direto no wizard.

---

## 5. Geração automática — onde mora a lógica

Função pura `src/lib/corrida-gerador.ts` (testável):

- `gerarSemana(params) → Sessao[]` — distribui sessões pelos dias escolhidos respeitando volume alvo e distribuição por tipo. Cada sessão recebe `pace_alvo`/`zona_fc` calculado a partir do perfil + zona definida no wizard.
- `gerarMesociclo(params) → Microciclo[]` (4 semanas) — aplica progressão 3:1, volume sobe linear/escalonado entre semanas 1–3, semana 4 = 60% do volume.
- `gerarMacrociclo(params) → Microciclo[]` — quebra em fases (Base / Específico / Pico / Taper) proporcionais à distância da prova e ao número de semanas; chama `gerarMesociclo` por bloco; respeita modelo de periodização (linear sobe sempre, polarizado mantém 80% Z1–Z2 / 20% Z4–Z5, etc.).

Persistência: server function `gerarPlano({ alunoId, semanas[] })` em `src/server/corrida-planner.functions.ts` — insere microciclos + sessões em transação (`requireSupabaseAuth`).

---

## 6. Ordem de implementação

1. **Migration**: campos novos + tabela `corrida_macrociclos`.
2. **Lib pura**: `paceToKmh`, `descreverZonaComEsteira`, exibição km/h em todos os pontos da UI atual (ganho imediato, baixo risco).
3. **Wizard de geração** (Sheet com 4 passos) + `gerarSemana` + botão "⚡ Gerar" salvando 1 semana.
4. **Drag-and-drop** entre dias com `@dnd-kit/core` + menu `…` (duplicar/mover/substituir).
5. **Mesociclo + Macrociclo** (`gerarMesociclo`, `gerarMacrociclo`, server fn transacional, navegação entre semanas do mesmo macro).
6. **Regerar semana** (reabre wizard com `params_geracao` salvo).

---

## Detalhes técnicos

- Lib drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` (leves, sem dependência DOM pesada).
- Cálculo esteira: pace `mm:ss/km` → `kmh = 3600 / (mm*60+ss)`, arredondado a 1 casa, formato pt-BR (`10,9`).
- Wizard usa estado local (`useReducer`) e só toca o Supabase no passo 4.
- "Regerar semana" faz `delete + insert` igual ao `salvar()` atual, escopado ao microciclo.
- Server fn de geração em massa: bulk insert (`insert([...])`) num único round-trip por tabela.
- App do aluno: zero migração — só passa a renderizar `km/h` junto do `pace_alvo` que já lê.

---

## Pergunta antes de implementar

Confirmar se quer **macrociclo já nesta entrega** (passo 5) ou prefere ficar nos passos 1–4 primeiro (semana + meso + drag + esteira) e adicionar macro depois?
