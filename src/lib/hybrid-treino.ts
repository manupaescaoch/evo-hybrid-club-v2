export const HYBRID_BLOCK_TYPES = [
  ["WARM-UP", "Aquecimento geral e específico para preparar o atleta para a sessão."],
  ["MOBILITY", "Trabalho de mobilidade articular e amplitude de movimento."],
  ["ACTIVATION", "Exercícios de ativação muscular antes do trabalho principal."],
  ["SKILL / TECHNIQUE", "Prática técnica de movimentos, estações ou habilidades específicas."],
  ["STRENGTH", "Bloco de força com exercícios principais e acessórios."],
  ["POWER", "Trabalho de potência, velocidade e produção rápida de força."],
  ["ENGINE", "Condicionamento cardiorrespiratório com corrida e ergômetros."],
  ["HYROX SPECIFIC", "Treino específico com movimentos, estações e demandas semelhantes ao HYROX."],
  ["COMPROMISED RUNNING", "Corrida realizada sob fadiga após exercícios ou estações."],
  ["METCON", "Bloco metabólico combinando exercícios em intensidade elevada."],
  ["CONDITIONING", "Condicionamento físico geral e desenvolvimento da capacidade de trabalho."],
  ["ACCESSORY", "Exercícios complementares de força, estabilidade ou prevenção."],
  ["CORE", "Trabalho específico de tronco e estabilidade central."],
  ["FINISHER", "Bloco curto e intenso realizado ao final da sessão."],
  ["COOL DOWN", "Redução gradual da intensidade após o treino."],
  ["RECOVERY", "Atividades leves voltadas para recuperação, respiração e mobilidade."],
  ["CUSTOM", "Bloco livre definido pelo treinador."],
] as const;

export type HybridBlockType = (typeof HYBRID_BLOCK_TYPES)[number][0];

export const WORKOUT_FORMATS = [
  ["EMOM", "Executar uma tarefa no início de cada minuto. O tempo restante é descanso."],
  ["E2MOM", "Executar a tarefa a cada 2 minutos."],
  ["E3MOM", "Executar a tarefa a cada 3 minutos."],
  ["E4MOM", "Executar a tarefa a cada 4 minutos."],
  ["AMRAP", "Realizar o maior número possível de rounds ou repetições dentro do tempo determinado."],
  ["FOR TIME", "Completar o volume prescrito no menor tempo possível."],
  ["ROUNDS FOR TIME", "Completar os rounds prescritos no menor tempo possível."],
  ["CHIPPER", "Completar uma sequência única de tarefas na ordem prescrita."],
  ["INTERVALS", "Alternar períodos definidos de trabalho e recuperação."],
  ["WORK / REST", "Alternar blocos explícitos de trabalho e descanso."],
  ["LADDER", "Aumentar ou reduzir progressivamente repetições, carga ou distância."],
  ["MAX REPS", "Acumular o maior número possível de repetições."],
  ["MAX DISTANCE", "Percorrer a maior distância possível."],
  ["MAX CALORIES", "Acumular o maior número possível de calorias."],
  ["QUALITY", "Executar com foco em qualidade técnica, sem prioridade de tempo."],
  ["RACE PACE", "Executar em ritmo-alvo de prova."],
  ["CUSTOM", "Formato livre definido pelo treinador."],
] as const;

export type WorkoutFormat = (typeof WORKOUT_FORMATS)[number][0];

export const RESULT_TYPES = [
  "Tempo",
  "Rounds + Reps",
  "Repetições",
  "Distância",
  "Calorias",
  "Carga",
  "Pontuação",
  "Resultado personalizado",
] as const;

export type ResultType = (typeof RESULT_TYPES)[number];

export function suggestResultType(format?: string | null, blockType?: string | null): ResultType {
  switch ((format ?? "").toUpperCase()) {
    case "FOR TIME":
    case "ROUNDS FOR TIME":
      return "Tempo";
    case "AMRAP":
      return "Rounds + Reps";
    case "MAX REPS":
      return "Repetições";
    case "MAX DISTANCE":
      return "Distância";
    case "MAX CALORIES":
      return "Calorias";
  }
  if ((blockType ?? "").toUpperCase() === "STRENGTH") return "Carga";
  return "Pontuação";
}

export function suggestRankingCriterion(resultType?: string | null): "menor" | "maior" {
  return resultType === "Tempo" ? "menor" : "maior";
}

export function normalizeLegacyBlockType(tipo?: string | null): HybridBlockType {
  const raw = (tipo ?? "").toLowerCase();
  const map: Record<string, HybridBlockType> = {
    aquecimento: "WARM-UP",
    mobilidade: "MOBILITY",
    forca: "STRENGTH",
    intervalado: "ENGINE",
    rodagem: "ENGINE",
    tempo: "ENGINE",
    strides: "ACTIVATION",
    desaquecimento: "COOL DOWN",
  };
  const upper = (tipo ?? "").toUpperCase() as HybridBlockType;
  if (HYBRID_BLOCK_TYPES.some(([value]) => value === upper)) return upper;
  return map[raw] ?? "CUSTOM";
}

export const DEFAULT_HYBRID_STRUCTURE: HybridBlockType[] = [
  "WARM-UP",
  "STRENGTH",
  "HYROX SPECIFIC",
  "FINISHER",
  "COOL DOWN",
];
