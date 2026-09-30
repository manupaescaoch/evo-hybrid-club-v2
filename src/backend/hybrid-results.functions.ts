import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAlunoAuth } from "./aluno-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const resultadoSchema = z.object({
  sessaoId: z.string().uuid(),
  blocoId: z.string().uuid().nullable().optional(),
  tipoResultado: z.string().min(1),
  valorNumero: z.number().finite().nullable().optional(),
  valorTexto: z.string().max(200).nullable().optional(),
  unidade: z.string().max(40).nullable().optional(),
});

export const salvarResultadoHybrid = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) => resultadoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const alunoId = context.alunoId;
    const sb = supabaseAdmin as any;
    const blocoId = data.blocoId ?? null;

    let query = sb
      .from("corrida_resultados")
      .select("id")
      .eq("sessao_id", data.sessaoId)
      .eq("aluno_id", alunoId);
    query = blocoId ? query.eq("bloco_id", blocoId) : query.is("bloco_id", null);
    const { data: existente, error: findError } = await query.maybeSingle();
    if (findError) throw findError;

    const payload = {
      sessao_id: data.sessaoId,
      bloco_id: blocoId,
      aluno_id: alunoId,
      tipo_resultado: data.tipoResultado,
      valor_numero: data.valorNumero ?? null,
      valor_texto: data.valorTexto?.trim() || null,
      unidade: data.unidade?.trim() || null,
      atualizado_em: new Date().toISOString(),
    };

    if (existente?.id) {
      const { error } = await sb.from("corrida_resultados").update(payload).eq("id", existente.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("corrida_resultados").insert(payload);
      if (error) throw error;
    }

    return { ok: true as const };
  });

export const getRankingHybrid = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sessaoId: z.string().uuid(),
      blocoId: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin as any;
    const blocoId = data.blocoId ?? null;

    let criterio: "menor" | "maior" = "maior";
    let rankingHabilitado = true;
    if (blocoId) {
      const { data: bloco } = await sb
        .from("corrida_sessao_blocos")
        .select("ranking_habilitado, criterio_ranking")
        .eq("id", blocoId)
        .maybeSingle();
      rankingHabilitado = !!bloco?.ranking_habilitado;
      criterio = bloco?.criterio_ranking === "menor" ? "menor" : "maior";
    } else {
      const { data: sessao } = await sb
        .from("corrida_sessoes")
        .select("resultado_geral_habilitado, resultado_geral_criterio")
        .eq("id", data.sessaoId)
        .maybeSingle();
      rankingHabilitado = !!sessao?.resultado_geral_habilitado;
      criterio = sessao?.resultado_geral_criterio === "menor" ? "menor" : "maior";
    }

    if (!rankingHabilitado) return { ranking: [], posicao: null, total: 0 };

    let q = sb
      .from("corrida_resultados")
      .select("id, aluno_id, valor_numero, valor_texto, unidade, criado_em, alunos(nome)")
      .eq("sessao_id", data.sessaoId)
      .not("valor_numero", "is", null);
    q = blocoId ? q.eq("bloco_id", blocoId) : q.is("bloco_id", null);
    const { data: rows, error } = await q.order("valor_numero", { ascending: criterio === "menor" }).limit(100);
    if (error) throw error;

    const ranking = (rows ?? []).map((r: any, index: number) => ({
      posicao: index + 1,
      aluno_id: r.aluno_id,
      nome: r.alunos?.nome ?? "Atleta",
      valor_numero: r.valor_numero,
      valor_texto: r.valor_texto,
      unidade: r.unidade,
    }));
    const ownIndex = ranking.findIndex((r: any) => r.aluno_id === context.alunoId);

    return {
      ranking,
      posicao: ownIndex >= 0 ? ownIndex + 1 : null,
      total: ranking.length,
    };
  });
