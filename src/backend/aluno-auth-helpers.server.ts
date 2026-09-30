import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAlunoSessionServer } from "./aluno-session.server";

export function digits(s: string) {
  return (s || "").replace(/\D/g, "");
}

/** Senha inicial = DDD + número (sem o código do país 55). */
export function senhaInicialFromWhatsapp(whatsapp: string) {
  let d = digits(whatsapp);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

export async function setAlunoCookie(
  row: {
    id: string;
    nome: string;
    email: string | null;
    whatsapp: string | null;
    foto_url?: string | null;
  },
  deveTrocarSenha: boolean,
) {
  const session = await getAlunoSessionServer();
  await session.update({
    aluno_id: row.id,
    nome: row.nome,
    email: row.email ?? null,
    whatsapp: row.whatsapp ?? null,
    foto_url: row.foto_url ?? null,
    deve_trocar_senha: deveTrocarSenha,
    iat: Math.floor(Date.now() / 1000),
  });
}

export async function loadDashboard(alunoId: string) {
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const hojeStr = new Date().toISOString().slice(0, 10);
  const sb = supabaseAdmin as any;

  // Roda todas as queries independentes em paralelo (12 → ~1 round-trip)
  const [
    alunoRes,
    avaliacoesRes,
    dietaRes,
    checkinsRes,
    entregasRes,
    feedbacksRes,
    transacoesRes,
    comunicacoesRes,
    aguaHojeRes,
    atividadesHojeRes,
    refeicoesHojeRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("alunos")
      .select(
        "id, nome, email, whatsapp, sexo, data_nascimento, altura_cm, peso_kg, status, modalidade, plano, servico_contratado, valor_plano, prazo_dias, data_compra, data_anamnese, data_d0, data_expiracao, total_renovacoes, observacoes, foto_url",
      )
      .eq("id", alunoId)
      .maybeSingle(),
    supabaseAdmin
      .from("physical_assessments")
      .select(
        "id, assessment_date, weight, height, body_fat_percentage, lean_mass_kg, fat_mass_kg, bmi, lean_mass_percentage, assessment_type",
      )
      .eq("student_id", alunoId)
      .order("assessment_date", { ascending: false })
      .limit(24),
    supabaseAdmin
      .from("dieta_planos")
      .select(
        "id, nome, status, meta_kcal, ptn_g_kg, cho_g_kg, lip_g_kg, peso_referencia, dias_semana, atualizado_em",
      )
      .eq("aluno_id", alunoId)
      .eq("status", "ativo")
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("daily_checkins")
      .select(
        "id, data_checkin, sono_horas, qualidade_sono, energia, humor, score_gerado",
      )
      .eq("aluno_id", alunoId)
      .gte("data_checkin", since30)
      .order("data_checkin", { ascending: false }),
    sb
      .from("entregas_dia")
      .select("data_referencia, dieta_entregue, treino_entregue, d0_confirmado")
      .eq("aluno_id", alunoId)
      .gte("data_referencia", since30)
      .order("data_referencia", { ascending: false }),
    sb
      .from("feedback_envios")
      .select(
        "id, status, enviado_em, respondido_em, respostas, template_id, feedback_templates(nome, tipo)",
      )
      .eq("aluno_id", alunoId)
      .order("enviado_em", { ascending: false })
      .limit(8),
    sb
      .from("transacoes")
      .select("id, tipo, valor, descricao, competencia, data_transacao, criado_em")
      .eq("aluno_id", alunoId)
      .order("criado_em", { ascending: false })
      .limit(10),
    sb
      .from("comunicacoes")
      .select("id, gatilho, canal, status, mensagem, enviado_em")
      .eq("aluno_id", alunoId)
      .order("enviado_em", { ascending: false })
      .limit(10),
    sb
      .from("aluno_agua_log")
      .select("ml")
      .eq("aluno_id", alunoId)
      .eq("data_referencia", hojeStr),
    sb
      .from("aluno_atividades_dia")
      .select("tipo, concluido")
      .eq("aluno_id", alunoId)
      .eq("data_referencia", hojeStr),
    sb
      .from("aluno_refeicoes_log")
      .select("refeicao_id, refeicao_nome")
      .eq("aluno_id", alunoId)
      .eq("data_referencia", hojeStr),
  ]);

  const aluno = alunoRes.data;
  const avaliacoes = avaliacoesRes.data;
  const dieta = dietaRes.data;
  const checkins = checkinsRes.data;
  const entregas = entregasRes.data;
  const feedbacks = feedbacksRes.data;
  const transacoes = transacoesRes.data;
  const comunicacoes = comunicacoesRes.data;
  const atividadesHoje = atividadesHojeRes.data;
  const refeicoesHoje = refeicoesHojeRes.data;
  const agua_ml_hoje = (aguaHojeRes.data ?? []).reduce(
    (s: number, r: any) => s + Number(r.ml || 0),
    0,
  );

  // Circunferências dependem da última avaliação → 1 query extra serial
  const ultimaAval = avaliacoes?.[0];
  let circunferencias: any = null;
  if (ultimaAval?.id) {
    const { data } = await supabaseAdmin
      .from("body_circumferences")
      .select("*")
      .eq("assessment_id", ultimaAval.id)
      .maybeSingle();
    circunferencias = data;
  }

  return {
    aluno,
    avaliacoes: avaliacoes ?? [],
    circunferencias,
    dieta,
    checkins: checkins ?? [],
    entregas: entregas ?? [],
    feedbacks: feedbacks ?? [],
    transacoes: transacoes ?? [],
    comunicacoes: comunicacoes ?? [],
    agua_ml_hoje,
    atividades_hoje: atividadesHoje ?? [],
    refeicoes_hoje: refeicoesHoje ?? [],
  };
}