import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalAlunoAuth } from "./aluno-middleware";

export type AlunoTreinoBloco = {
  id: string;
  ordem: number;
  tipo: string;
  nome: string;
  descricao: string | null;
  duracao_min: string | null;
  pace: string | null;
  zona: string | null;
  series: string | null;
  distancia_serie: string | null;
  recuperacao: string | null;
  formato?: string | null;
  prescricao?: string | null;
  orientacoes?: string | null;
  resultado_habilitado?: boolean;
  tipo_resultado?: string | null;
  unidade_resultado?: string | null;
  ranking_habilitado?: boolean;
  criterio_ranking?: string | null;
  visibilidade_ranking?: Record<string, boolean> | null;
};

export type AlunoTreinoSessao = {
  id: string;
  data: string;
  ordem_no_dia: number;
  tipo: string;
  nome: string;
  duracao_min: number | null;
  distancia_km: number | null;
  pace_alvo: string | null;
  zona_fc: string | null;
  objetivo: string | null;
  observacao: string | null;
  executada: boolean;
  categoria?: string | null;
  unidade?: string | null;
  resultado_geral_habilitado?: boolean;
  resultado_geral_tipo?: string | null;
  resultado_geral_unidade?: string | null;
  resultado_geral_criterio?: string | null;
  blocos: AlunoTreinoBloco[];
};

export const getSemanaTreinoAluno = createServerFn({ method: "POST" })
  .middleware([optionalAlunoAuth])
  .inputValidator((d) =>
    z.object({ inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ sessoes: AlunoTreinoSessao[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // A programação publicada pela Manu é a grade oficial do clube e deve
    // aparecer igual para todos os alunos. O aluno autenticado continua sendo
    // validado pelo middleware, mas não define mais qual grade será exibida.
    const { data: micros, error: microsError } = await sb
      .from("corrida_microciclos")
      .select("id, atualizado_em")
      .eq("status", "publicada")
      .ilike("criado_por", "%manu%")
      .order("atualizado_em", { ascending: false });
    if (microsError) throw new Error("Não foi possível carregar a programação de treinos.");

    const microIds = (micros ?? []).map((m: any) => m.id);
    if (microIds.length === 0) return { sessoes: [] };

    const { data: sessoes, error: sessoesError } = await sb
      .from("corrida_sessoes")
      .select(
        "id, microciclo_id, data, ordem_no_dia, tipo, nome, duracao_min, distancia_km, pace_alvo, zona_fc, objetivo, observacao, executada, categoria, unidade, resultado_geral_habilitado, resultado_geral_tipo, resultado_geral_unidade, resultado_geral_criterio, corrida_sessao_blocos(id, ordem, tipo, nome, descricao, duracao_min, pace, zona, series, distancia_serie, recuperacao, formato, prescricao, orientacoes, resultado_habilitado, tipo_resultado, unidade_resultado, ranking_habilitado, criterio_ranking, visibilidade_ranking, ativo)",
      )
      .in("microciclo_id", microIds)
      .gte("data", data.inicio)
      .lte("data", data.fim)
      .order("data")
      .order("ordem_no_dia");
    if (sessoesError) throw new Error("Não foi possível carregar os treinos da semana.");

    // Há cópias históricas da mesma programação em perfis diferentes. Usa a
    // cópia mais recentemente atualizada para não repetir sessões na tela.
    const microComTreino = microIds.find((id: string) =>
      (sessoes ?? []).some((s: any) => s.microciclo_id === id),
    );
    if (!microComTreino) return { sessoes: [] };

    return {
      sessoes: (sessoes ?? []).filter((s: any) => s.microciclo_id === microComTreino).map((s: any) => ({
        ...s,
        microciclo_id: undefined,
        executada: false,
        blocos: [...(s.corrida_sessao_blocos ?? [])]
          .filter((b: any) => b.ativo !== false)
          .sort((a: any, b: any) => a.ordem - b.ordem),
        corrida_sessao_blocos: undefined,
      })),
    };
  });
