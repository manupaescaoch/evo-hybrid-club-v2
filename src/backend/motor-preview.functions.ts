import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";

/**
 * Gera, sem enviar, a mensagem que seria disparada para o aluno num determinado tipo de job.
 * Útil para a UI mostrar uma prévia antes do envio real.
 */

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? `{${k}}`);
}

async function getConfigMap(chaves: string[]): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .in("chave", chaves);
  const out: Record<string, string> = {};
  (data ?? []).forEach((r: any) => { out[r.chave] = r.valor ?? ""; });
  return out;
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
  const sys = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => k === "nome_aluno" ? nomeCurto : `{{${k}}}`)
    + "\n\nIMPORTANTE: Escreva a mensagem final pronta para envio. NÃO use placeholders.";
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

export const previewMensagemJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { alunoId: string; tipo: string; formularioId?: string | null }) => ({
    alunoId: String(data.alunoId),
    tipo: String(data.tipo),
    formularioId: data.formularioId ?? null,
  }))
  .handler(async ({ data }) => {
    const { data: aluno } = await supabaseAdmin
      .from("alunos")
      .select("id, nome, whatsapp")
      .eq("id", data.alunoId)
      .maybeSingle();
    if (!aluno) return { mensagem: null, error: "Aluno não encontrado" };

    const cfg = await getConfigMap([
      "MSG_CONFIRMACAO_ANAMNESE",
      "MSG_LINK_QUINZENAL",
      "MSG_LINK_MENSAL",
      "MSG_POS_FEEDBACK_MENSAL",
      "MSG_ANIVERSARIO",
      "FORM_URL_QUINZENAL",
      "FORM_URL_MENSAL",
      "MSG_LEMBRETE_FEEDBACK",
      "APP_BASE_URL",
    ]);

    const nome = primeiroNome(aluno.nome);

    switch (data.tipo) {
      case "anamnese_confirmacao":
        return { mensagem: renderTemplate(cfg["MSG_CONFIRMACAO_ANAMNESE"] || "", { nome }), error: null };
      case "feedback_quinzenal_link":
        return { mensagem: renderTemplate(cfg["MSG_LINK_QUINZENAL"] || "", { nome, link: cfg["FORM_URL_QUINZENAL"] || "" }), error: null };
      case "feedback_mensal_link":
        return { mensagem: renderTemplate(cfg["MSG_LINK_MENSAL"] || "", { nome, link: cfg["FORM_URL_MENSAL"] || "" }), error: null };
      case "pos_feedback_mensal":
        return { mensagem: renderTemplate(cfg["MSG_POS_FEEDBACK_MENSAL"] || "", { nome }), error: null };
      case "aniversario":
        return { mensagem: renderTemplate(cfg["MSG_ANIVERSARIO"] || "", { nome }), error: null };
      case "feedback_link_lembrete": {
        let link = "";
        let tipoForm: string | null = null;
        if (data.formularioId) {
          const { data: f } = await supabaseAdmin
            .from("formularios")
            .select("id, tipo, token, link_publico")
            .eq("id", data.formularioId)
            .maybeSingle();
          if (f) {
            tipoForm = f.tipo;
            link = f.link_publico
              || (cfg["APP_BASE_URL"] ? `${cfg["APP_BASE_URL"].replace(/\/$/, "")}/formularios/${f.token}` : `/formularios/${f.token}`);
          }
        } else {
          link = cfg["FORM_URL_QUINZENAL"] || cfg["FORM_URL_MENSAL"] || "";
        }
        const tplCfg = cfg["MSG_LEMBRETE_FEEDBACK"] || "";
        const tpl = tplCfg.trim().length > 0
          ? tplCfg
          : "Fala, {nome}! Tudo certo?\n\nSeu feedback ainda está pendente.\nPreenche por aqui:\n\n{link_feedback}";
        return { mensagem: renderTemplate(tpl, { nome, link_feedback: link, link, tipo: tipoForm ?? "feedback" }), error: null };
      }
      case "followup_d7":
      case "followup_d21": {
        const r = await gerarTextoIA(data.tipo, aluno.nome);
        return { mensagem: r.mensagem, error: r.error };
      }
      default:
        return { mensagem: null, error: `Prévia não suportada para o tipo: ${data.tipo}` };
    }
  });