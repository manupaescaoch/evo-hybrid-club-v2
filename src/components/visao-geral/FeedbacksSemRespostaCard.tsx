import { useEffect, useState, useTransition } from "react";
import { Link } from "@tanstack/react-router";
import { MessageSquare, Send, MessageCircle, ExternalLink, Loader2, ChevronDown, ChevronUp, Check, Clock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  listFeedbacksSemResposta,
  agendarLembreteFeedback,
  type FeedbackPendente,
} from "@/backend/feedback-lembretes.functions";
import { dispararJobsAgora } from "@/backend/motor.functions";
import { toast } from "sonner";

const TIPO_LABEL: Record<string, string> = {
  feedback_quinzenal: "Quinzenal",
  feedback_mensal: "Mensal",
};
const MOD_LABEL: Record<string, string> = {
  mpteam: "EVO HYBRID CLUB", mp_elite: "MP Elite", mp_presencial: "MP Presencial",
};

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtRelativo(iso: string | null): string {
  if (!iso) return "Nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  return `há ${dias}d`;
}
function whatsappHref(phone: string): string {
  return `https://wa.me/${(phone || "").replace(/\D/g, "")}`;
}

export function FeedbacksSemRespostaCard() {
  const [itens, setItens] = useState<FeedbackPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const listFn = useServerFn(listFeedbacksSemResposta);
  const agendarFn = useServerFn(agendarLembreteFeedback);
  const dispararFn = useServerFn(dispararJobsAgora);

  async function carregar() {
    setLoading(true);
    try {
      const r = await listFn();
      setItens(r.itens);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function reenviar(item: FeedbackPendente) {
    setBusyId(item.formulario_id);
    try {
      const r = await agendarFn({ data: { formularioId: item.formulario_id } });
      if (!r.ok || !r.jobId) {
        toast.error(r.error || "Falha ao agendar lembrete");
        return;
      }
      const d = await dispararFn({ data: { ids: [r.jobId], intervaloMs: 0 } });
      const det = d.detalhes?.[0];
      if (det?.ok) {
        toast.success("Lembrete enviado");
        startTransition(() => { void carregar(); });
      } else {
        toast.error(det?.error || "Falha ao enviar lembrete");
      }
    } finally { setBusyId(null); }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando feedbacks pendentes...
        </div>
      </div>
    );
  }

  if (itens.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-amber-300/60 bg-amber-50/40 dark:bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-amber-100/50 dark:hover:bg-amber-500/10 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm sm:text-base">Feedbacks sem resposta</div>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span>Total: <strong className="text-amber-700">{itens.length}</strong></span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pendentes há 3 dias ou mais
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs text-muted-foreground">{open ? "Fechar" : "Ver alunos"}</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-amber-300/50 bg-card divide-y divide-border max-h-96 overflow-y-auto">
          {itens.map((it) => {
            const lembreteEnviado = !!it.lembrete_enviado_em;
            return (
              <div key={it.formulario_id} className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to="/alunos/$id"
                        params={{ id: it.aluno_id }}
                        className="font-semibold text-sm hover:underline truncate"
                      >
                        {it.aluno_nome}
                      </Link>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        {TIPO_LABEL[it.tipo] ?? it.tipo}
                      </span>
                      {it.modalidade && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {MOD_LABEL[it.modalidade] ?? it.modalidade}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                        {it.dias_sem_resposta} {it.dias_sem_resposta === 1 ? "dia" : "dias"} sem resposta
                      </span>
                      {lembreteEnviado && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> Lembrete {fmtRelativo(it.lembrete_enviado_em)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Enviado: <strong className="text-foreground">{fmtData(it.enviado_em)}</strong></span>
                      <span>Tel: {it.whatsapp || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => reenviar(it)}
                      disabled={busyId === it.formulario_id || !it.whatsapp}
                      title={lembreteEnviado ? "Reenviar lembrete" : "Enviar lembrete"}
                      className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {busyId === it.formulario_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{lembreteEnviado ? "Reenviar" : "Lembrete"}</span>
                    </button>
                    <a
                      href={whatsappHref(it.whatsapp)}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir WhatsApp"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted text-emerald-600"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                    <Link
                      to="/alunos/$id"
                      params={{ id: it.aluno_id }}
                      title="Abrir ficha do aluno"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}