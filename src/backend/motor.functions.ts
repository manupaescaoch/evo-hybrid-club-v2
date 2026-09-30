import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";
import { requireAuthOrCron } from "./auth-or-cron.middleware";

/* ----------------------------------------------------------------- */
/*  Motor de automações EVO HYBRID CLUB                                       */
/*  Lê jobs_disparos pendentes cujo agendado_para <= now() e dispara */
/*  cada um conforme seu tipo. Respeita a flag MOTOR_ATIVO.          */
/* ----------------------------------------------------------------- */

function onlyDigits(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}

async function getConfigMap(chaves: string[]): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .in("chave", chaves);
  const out: Record<string, string> = {};
  (data ?? []).forEach((r) => { out[r.chave] = r.valor ?? ""; });
  return out;
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? `{${k}}`);
}

async function sendZapi(phone: string, message: string): Promise<{ ok: boolean; error: string | null }> {
  const instance = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !clientToken) return { ok: false, error: "Z-API não configurada" };
  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone, message }),
    });
    if (!r.ok) return { ok: false, error: `Z-API ${r.status}: ${(await r.text()).slice(0, 200)}` };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha Z-API" };
  }
}

async function gerarTextoIA(promptTipo: string, nomeAluno: string): Promise<{ mensagem: string | null; error: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { mensagem: null, error: "OPENAI_API_KEY ausente" };
  const { data: promptRow } = await supabaseAdmin
    .from("prompts_ia")
    .select("prompt_sistema")
    .eq("tipo", promptTipo as any)
    .maybeSingle();
  const rawPrompt = promptRow?.prompt_sistema?.trim()
    || `Você escreve mensagens curtas e motivadoras para alunos de consultoria. Seja direto e caloroso.`;
  const nomeCurto = primeiroNome(nomeAluno);
  const vars: Record<string, string> = { nome_aluno: nomeCurto };
  const sys = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`)
    + "\n\nIMPORTANTE: Escreva a mensagem final pronta para envio. NÃO use placeholders entre chaves ou colchetes. Se faltar dado, reescreva a frase de forma genérica.";
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Gere a mensagem de WhatsApp para ${nomeCurto}.` },
        ],
      }),
    });
    if (!r.ok) return { mensagem: null, error: `OpenAI ${r.status}` };
    const j = await r.json();
    const m = j?.choices?.[0]?.message?.content?.trim() ?? "";
    return m ? { mensagem: m, error: null } : { mensagem: null, error: "IA vazia" };
  } catch (e) {
    return { mensagem: null, error: e instanceof Error ? e.message : "Falha IA" };
  }
}

async function gerarRespostaFeedbackIA(alunoId: string, tipoForm: "feedback_quinzenal" | "feedback_mensal"): Promise<{ mensagem: string | null; error: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { mensagem: null, error: "OPENAI_API_KEY ausente" };
  // Busca o último formulário respondido desse tipo desse aluno
  const { data: form } = await supabaseAdmin
    .from("formularios")
    .select("id, dados_resposta")
    .eq("aluno_id", alunoId)
    .eq("tipo", tipoForm as any)
    .eq("respondido", true)
    .order("respondido_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!form?.dados_resposta) return { mensagem: null, error: "Sem formulário respondido" };

  const { data: aluno } = await supabaseAdmin.from("alunos").select("nome").eq("id", alunoId).maybeSingle();
  const { data: promptRow } = await supabaseAdmin
    .from("prompts_ia")
    .select("prompt_sistema")
    .eq("tipo", tipoForm as any)
    .maybeSingle();
  const raw = promptRow?.prompt_sistema?.trim()
    || "Você é um Customer Success que responde feedbacks de aluno. Seja claro, objetivo e firme.";
  const respostas = JSON.stringify(form.dados_resposta, null, 2);
  const nomeCurto = primeiroNome(aluno?.nome) || "aluno";
  const vars: Record<string, string> = { nome_aluno: nomeCurto, respostas };
  const sys = raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`)
    + "\n\nIMPORTANTE: Mensagem final pronta para WhatsApp. Não use placeholders.";
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Nome do aluno: ${nomeCurto}\n\nRespostas:\n${respostas}` },
        ],
      }),
    });
    if (!r.ok) return { mensagem: null, error: `OpenAI ${r.status}` };
    const j = await r.json();
    const m = j?.choices?.[0]?.message?.content?.trim() ?? "";
    return m ? { mensagem: m, error: null } : { mensagem: null, error: "IA vazia" };
  } catch (e) {
    return { mensagem: null, error: e instanceof Error ? e.message : "Falha IA" };
  }
}

type JobRow = {
  id: string;
  aluno_id: string | null;
  tipo: string;
  agendado_para: string;
  tentativas: number;
  formulario_id?: string | null;
};

async function processarJob(job: JobRow, cfg: Record<string, string>): Promise<{ ok: boolean; error: string | null; mensagem?: string }> {
  if (!job.aluno_id) return { ok: false, error: "Job sem aluno_id" };

  const { data: aluno } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, whatsapp")
    .eq("id", job.aluno_id)
    .maybeSingle();
  if (!aluno) return { ok: false, error: "Aluno não encontrado" };
  const phone = onlyDigits(aluno.whatsapp);
  if (phone.length < 10) return { ok: false, error: "WhatsApp inválido" };

  let mensagem = "";
  switch (job.tipo) {
    case "anamnese_confirmacao": {
      const tpl = cfg["MSG_CONFIRMACAO_ANAMNESE"] || "";
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      break;
    }
    case "feedback_quinzenal_link": {
      const tpl = cfg["MSG_LINK_QUINZENAL"] || "";
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome), link: cfg["FORM_URL_QUINZENAL"] || "" });
      break;
    }
    case "feedback_mensal_link": {
      const tpl = cfg["MSG_LINK_MENSAL"] || "";
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome), link: cfg["FORM_URL_MENSAL"] || "" });
      break;
    }
    case "pos_feedback_mensal": {
      const tpl = cfg["MSG_POS_FEEDBACK_MENSAL"] || "";
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      break;
    }
    case "pos_entrega_d1": {
      const tpl = cfg["MSG_POS_ENTREGA_D1"] || "";
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      break;
    }
    case "feedback_link_lembrete": {
      // Lembrete de formulário de feedback ainda sem resposta.
      // Usa o link público do formulário específico (job.formulario_id).
      let link = "";
      let tipoForm: string | null = null;
      if (job.formulario_id) {
        const { data: f } = await supabaseAdmin
          .from("formularios")
          .select("id, tipo, token, link_publico, respondido")
          .eq("id", job.formulario_id)
          .maybeSingle();
        if (!f) return { ok: false, error: "Formulário do lembrete não encontrado" };
        if (f.respondido) return { ok: false, error: "Formulário já respondido — lembrete cancelado" };
        tipoForm = f.tipo;
        link = f.link_publico
          || (cfg["APP_BASE_URL"] ? `${cfg["APP_BASE_URL"].replace(/\/$/, "")}/formularios/${f.token}` : `/formularios/${f.token}`);
      } else {
        link = cfg["FORM_URL_QUINZENAL"] || cfg["FORM_URL_MENSAL"] || "";
      }
      const tplCfg = cfg["MSG_LEMBRETE_FEEDBACK"] || "";
      const tpl = tplCfg.trim().length > 0
        ? tplCfg
        : "Fala, {nome}! Tudo certo?\n\nSeu feedback ainda está pendente.\nPreenche por aqui para a gente conseguir acompanhar sua evolução e ajustar o que for necessário:\n\n{link_feedback}";
      mensagem = renderTemplate(tpl, {
        nome: primeiroNome(aluno.nome),
        link_feedback: link,
        link,
        tipo: tipoForm ?? "feedback",
      });
      break;
    }
    case "aniversario": {
      const tpl = cfg["MSG_ANIVERSARIO"] || "";
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      break;
    }
    case "followup_d7":
    case "followup_d21": {
      const r = await gerarTextoIA(job.tipo, aluno.nome);
      if (!r.mensagem) return { ok: false, error: r.error };
      mensagem = r.mensagem;
      break;
    }
    case "feedback_quinzenal_resposta":
    case "feedback_mensal_resposta": {
      const tipoForm = job.tipo === "feedback_quinzenal_resposta" ? "feedback_quinzenal" : "feedback_mensal";
      const r = await gerarRespostaFeedbackIA(aluno.id, tipoForm);
      if (!r.mensagem) return { ok: false, error: r.error };
      mensagem = r.mensagem;
      break;
    }
    default:
      return { ok: false, error: `Tipo de job não suportado pelo motor: ${job.tipo}` };
  }

  if (!mensagem.trim()) return { ok: false, error: "Mensagem vazia" };

  const send = await sendZapi(phone, mensagem);

  await supabaseAdmin.from("mensagens_log").insert({
    aluno_id: aluno.id,
    tipo_job: job.tipo,
    mensagem_enviada: mensagem,
    whatsapp_destino: phone,
    status_envio: send.ok ? "enviado" : "erro",
    erro_detalhe: send.error,
  });

  // Notifica o grupo de "Respostas de feedbacks" em tempo real para tipos relevantes.
  const tiposNotificaveis = new Set([
    "feedback_quinzenal_link",
    "feedback_mensal_link",
    "feedback_link_lembrete",
    "feedback_quinzenal_resposta",
    "feedback_mensal_resposta",
    "followup_d7",
    "followup_d21",
  ]);
  if (tiposNotificaveis.has(job.tipo)) {
    try {
      const { dispararSnapshotRespostasFeedbacks } = await import("./notificacoes-feedbacks.server");
      await dispararSnapshotRespostasFeedbacks(`motor:${job.tipo}`);
    } catch (e) {
      console.error("[motor] falha ao disparar snapshot respostas_feedbacks:", e);
    }
  }

  return { ok: send.ok, error: send.error, mensagem };
}

/**
 * Executa um ciclo do motor: processa todos os jobs pendentes vencidos.
 * Respeita a flag MOTOR_ATIVO em workflow_config — se desligada, retorna
 * { skipped: true } sem fazer nada.
 */
export const runMotorAutomacoes = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((data: { force?: boolean } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const force = data?.force === true;
    const cfg = await getConfigMap([
      "MOTOR_ATIVO",
      "MSG_CONFIRMACAO_ANAMNESE",
      "MSG_LINK_QUINZENAL",
      "MSG_LINK_MENSAL",
      "MSG_POS_FEEDBACK_MENSAL",
      "MSG_POS_ENTREGA_D1",
      "MSG_ANIVERSARIO",
      "FORM_URL_QUINZENAL",
      "FORM_URL_MENSAL",
      "MSG_LEMBRETE_FEEDBACK",
      "APP_BASE_URL",
    ]);
    const ativo = (cfg["MOTOR_ATIVO"] ?? "false").toLowerCase() === "true";
    if (!ativo && !force) return { skipped: true, reason: "MOTOR_ATIVO=false", processados: 0 };

    const { data: jobs } = await supabaseAdmin
      .from("jobs_disparos")
      .select("id, aluno_id, tipo, agendado_para, tentativas, formulario_id")
      .eq("executado", false)
      .lte("agendado_para", new Date().toISOString())
      .order("agendado_para", { ascending: true })
      .limit(50);

    // Ordena por prioridade de fluxo:
    // 1) respostas de feedback + pos_feedback_mensal
    // 2) follow-ups D+7 / D+21
    // 3) links de feedback (mensal/quinzenal)
    // 4) demais (anamnese_confirmacao etc.)
    const prioridade: Record<string, number> = {
      feedback_quinzenal_resposta: 1,
      feedback_mensal_resposta: 1,
      pos_feedback_mensal: 1,
      followup_d7: 2,
      followup_d21: 2,
      feedback_quinzenal_link: 3,
      feedback_mensal_link: 3,
    };
    const listaOrdenada = [...((jobs ?? []) as JobRow[])].sort((a, b) => {
      const pa = prioridade[a.tipo] ?? 9;
      const pb = prioridade[b.tipo] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.agendado_para.localeCompare(b.agendado_para);
    });

    let ok = 0; let fail = 0;
    for (const j of listaOrdenada) {
      try {
        const r = await processarJob(j, cfg);
        if (r.ok) {
          await supabaseAdmin.from("jobs_disparos")
            .update({ executado: true, executado_em: new Date().toISOString(), erro: null, tentativas: (j.tentativas ?? 0) + 1 })
            .eq("id", j.id);
          ok++;
        } else {
          await supabaseAdmin.from("jobs_disparos")
            .update({ erro: r.error ?? "Falha desconhecida", tentativas: (j.tentativas ?? 0) + 1 })
            .eq("id", j.id);
          fail++;
        }
      } catch (e) {
        await supabaseAdmin.from("jobs_disparos")
          .update({ erro: e instanceof Error ? e.message : "Exceção", tentativas: (j.tentativas ?? 0) + 1 })
          .eq("id", j.id);
        fail++;
      }
    }

    return { skipped: false, processados: (jobs ?? []).length, ok, fail };
  });

/**
 * Dispara uma lista específica de jobs AGORA, com intervalo entre envios para
 * não bloquear o WhatsApp. Ignora a flag MOTOR_ATIVO (uso manual via UI).
 */
export const dispararJobsAgora = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((data: { ids: string[]; intervaloMs?: number }) => ({
    ids: Array.isArray(data?.ids) ? data.ids.filter((x) => typeof x === "string") : [],
    intervaloMs: typeof data?.intervaloMs === "number" && data.intervaloMs >= 0 ? data.intervaloMs : 10_000,
  }))
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return { processados: 0, ok: 0, fail: 0, detalhes: [] as Array<{ id: string; ok: boolean; error: string | null }> };

    const cfg = await getConfigMap([
      "MSG_CONFIRMACAO_ANAMNESE",
      "MSG_LINK_QUINZENAL",
      "MSG_LINK_MENSAL",
      "MSG_POS_FEEDBACK_MENSAL",
      "MSG_POS_ENTREGA_D1",
      "MSG_ANIVERSARIO",
      "FORM_URL_QUINZENAL",
      "FORM_URL_MENSAL",
      "MSG_LEMBRETE_FEEDBACK",
      "APP_BASE_URL",
    ]);

    const { data: jobs } = await supabaseAdmin
      .from("jobs_disparos")
      .select("id, aluno_id, tipo, agendado_para, tentativas, formulario_id")
      .in("id", data.ids)
      .eq("executado", false);

    let ok = 0; let fail = 0;
    const detalhes: Array<{ id: string; ok: boolean; error: string | null }> = [];
    const lista = (jobs ?? []) as JobRow[];
    for (let i = 0; i < lista.length; i++) {
      const j = lista[i];
      if (i > 0 && data.intervaloMs > 0) {
        await new Promise((res) => setTimeout(res, data.intervaloMs));
      }
      try {
        const r = await processarJob(j, cfg);
        if (r.ok) {
          await supabaseAdmin.from("jobs_disparos")
            .update({ executado: true, executado_em: new Date().toISOString(), erro: null, tentativas: (j.tentativas ?? 0) + 1 })
            .eq("id", j.id);
          ok++;
          detalhes.push({ id: j.id, ok: true, error: null });
        } else {
          await supabaseAdmin.from("jobs_disparos")
            .update({ erro: r.error ?? "Falha desconhecida", tentativas: (j.tentativas ?? 0) + 1 })
            .eq("id", j.id);
          fail++;
          detalhes.push({ id: j.id, ok: false, error: r.error ?? "Falha desconhecida" });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Exceção";
        await supabaseAdmin.from("jobs_disparos")
          .update({ erro: msg, tentativas: (j.tentativas ?? 0) + 1 })
          .eq("id", j.id);
        fail++;
        detalhes.push({ id: j.id, ok: false, error: msg });
      }
    }

    return { processados: lista.length, ok, fail, detalhes };
  });