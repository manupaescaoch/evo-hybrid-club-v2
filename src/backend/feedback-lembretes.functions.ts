import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAuthOrCron } from "./auth-or-cron.middleware";

/**
 * Feedbacks sem resposta — formulários enviados há 3+ dias, ainda pendentes,
 * de alunos ativos. Inclui status do lembrete (job feedback_link_lembrete).
 */

export type FeedbackPendente = {
  formulario_id: string;
  token: string;
  link_publico: string | null;
  tipo: string;
  enviado_em: string;
  dias_sem_resposta: number;
  aluno_id: string;
  aluno_nome: string;
  whatsapp: string;
  modalidade: string | null;
  lembrete_agendado_em: string | null;
  lembrete_enviado_em: string | null;
};

const DIAS_PARA_LEMBRETE = 3;

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export const listFeedbacksSemResposta = createServerFn({ method: "GET" })
  .middleware([requireAuthOrCron])
  .handler(async () => {
  // Formulários de feedback (mensal/quinzenal) ainda não respondidos
  const limiteISO = new Date(Date.now() - DIAS_PARA_LEMBRETE * 86400000).toISOString();

  const { data: forms } = await supabaseAdmin
    .from("formularios")
    .select("id, aluno_id, tipo, token, link_publico, recebido_em, respondido")
    .in("tipo", ["feedback_quinzenal", "feedback_mensal"] as any)
    .eq("respondido", false)
    .lte("recebido_em", limiteISO)
    .not("aluno_id", "is", null)
    .order("recebido_em", { ascending: true })
    .limit(300);

  const lista = forms ?? [];
  if (lista.length === 0) return { itens: [] as FeedbackPendente[] };

  const alunoIds = Array.from(new Set(lista.map((f) => f.aluno_id!).filter(Boolean)));
  const formIds = lista.map((f) => f.id);

  const [{ data: alunos }, { data: jobs }, { data: logs }] = await Promise.all([
    supabaseAdmin
      .from("alunos")
      .select("id, nome, whatsapp, modalidade, status")
      .in("id", alunoIds)
      .eq("status", "ativo"),
    supabaseAdmin
      .from("jobs_disparos")
      .select("id, formulario_id, agendado_para, executado, executado_em" as any)
      .eq("tipo", "feedback_link_lembrete" as any)
      .in("formulario_id" as any, formIds as any),
    supabaseAdmin
      .from("mensagens_log")
      .select("aluno_id, tipo_job, enviado_em")
      .eq("tipo_job", "feedback_link_lembrete")
      .in("aluno_id", alunoIds)
      .order("enviado_em", { ascending: false }),
  ]);

  const alunosMap = new Map<string, { nome: string; whatsapp: string; modalidade: string | null }>();
  (alunos ?? []).forEach((a) => alunosMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp, modalidade: a.modalidade }));

  const jobByForm = new Map<string, { agendado_para: string; executado: boolean; executado_em: string | null }>();
  ((jobs ?? []) as any[]).forEach((j) => {
    if (j.formulario_id) jobByForm.set(j.formulario_id, j);
  });

  const logByAluno = new Map<string, string>();
  (logs ?? []).forEach((l) => {
    if (l.aluno_id && !logByAluno.has(l.aluno_id)) logByAluno.set(l.aluno_id, l.enviado_em);
  });

  const itens: FeedbackPendente[] = [];
  for (const f of lista) {
    if (!f.aluno_id) continue;
    const a = alunosMap.get(f.aluno_id);
    if (!a) continue; // aluno não ativo
    const job = jobByForm.get(f.id);
    itens.push({
      formulario_id: f.id,
      token: f.token,
      link_publico: f.link_publico,
      tipo: f.tipo,
      enviado_em: f.recebido_em,
      dias_sem_resposta: diasDesde(f.recebido_em),
      aluno_id: f.aluno_id,
      aluno_nome: a.nome,
      whatsapp: a.whatsapp,
      modalidade: a.modalidade,
      lembrete_agendado_em: job && !job.executado ? job.agendado_para : null,
      lembrete_enviado_em: job?.executado ? job.executado_em : (logByAluno.get(f.aluno_id) ?? null),
    });
  }

  return { itens };
});

/**
 * Cria (ou agenda imediatamente) um job feedback_link_lembrete para o formulário
 * informado. Idempotente — não duplica jobs pendentes.
 */
export const agendarLembreteFeedback = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: { formularioId: string; agendadoPara?: string | null }) => {
    if (!d?.formularioId) throw new Error("formularioId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: f } = await supabaseAdmin
      .from("formularios")
      .select("id, aluno_id, tipo, respondido")
      .eq("id", data.formularioId)
      .maybeSingle();
    if (!f) return { ok: false, error: "Formulário não encontrado" };
    if (f.respondido) return { ok: false, error: "Formulário já respondido" };
    if (!f.aluno_id) return { ok: false, error: "Formulário sem aluno" };

    // Já existe um job pendente para esse formulário?
    const { data: existente } = await supabaseAdmin
      .from("jobs_disparos")
      .select("id")
      .eq("formulario_id" as any, f.id as any)
      .eq("tipo", "feedback_link_lembrete" as any)
      .eq("executado", false)
      .maybeSingle();
    if (existente) return { ok: true, jobId: (existente as any).id, jaExistia: true };

    const agendado = data.agendadoPara ?? new Date().toISOString();
    const { data: novo, error } = await supabaseAdmin
      .from("jobs_disparos")
      .insert({
        aluno_id: f.aluno_id,
        tipo: "feedback_link_lembrete" as any,
        agendado_para: agendado,
        formulario_id: f.id,
      } as any)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, jobId: (novo as any)?.id ?? null, jaExistia: false };
  });

/**
 * Cron / hook: cria jobs feedback_link_lembrete para todos os formulários
 * elegíveis (D+3, sem resposta, aluno ativo, sem job prévio).
 */
export const gerarLembretesFeedbackPendentes = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .handler(async () => {
  const limiteISO = new Date(Date.now() - DIAS_PARA_LEMBRETE * 86400000).toISOString();

  const { data: forms } = await supabaseAdmin
    .from("formularios")
    .select("id, aluno_id, tipo")
    .in("tipo", ["feedback_quinzenal", "feedback_mensal"] as any)
    .eq("respondido", false)
    .lte("recebido_em", limiteISO)
    .not("aluno_id", "is", null)
    .limit(500);

  const lista = forms ?? [];
  if (lista.length === 0) return { criados: 0, total: 0 };

  const alunoIds = Array.from(new Set(lista.map((f) => f.aluno_id!).filter(Boolean)));
  const formIds = lista.map((f) => f.id);

  const [{ data: ativos }, { data: jobs }] = await Promise.all([
    supabaseAdmin.from("alunos").select("id").in("id", alunoIds).eq("status", "ativo"),
    supabaseAdmin
      .from("jobs_disparos")
      .select("formulario_id" as any)
      .eq("tipo", "feedback_link_lembrete" as any)
      .in("formulario_id" as any, formIds as any),
  ]);

  const ativosSet = new Set((ativos ?? []).map((a) => a.id));
  const jaTemJob = new Set(((jobs ?? []) as any[]).map((j) => j.formulario_id).filter(Boolean));

  const novos = lista
    .filter((f) => f.aluno_id && ativosSet.has(f.aluno_id) && !jaTemJob.has(f.id))
    .map((f) => ({
      aluno_id: f.aluno_id!,
      tipo: "feedback_link_lembrete" as any,
      agendado_para: new Date().toISOString(),
      formulario_id: f.id,
    }));

  if (novos.length === 0) return { criados: 0, total: lista.length };

  const { error } = await supabaseAdmin.from("jobs_disparos").insert(novos as any);
  if (error) return { criados: 0, total: lista.length, error: error.message };
  return { criados: novos.length, total: lista.length };
});