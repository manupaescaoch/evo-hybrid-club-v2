import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getJobsAtrasadosResumo,
  listarJobsAtrasados,
  descartarJobsAtrasados,
  reagendarJobsHorarioComercial,
  setMotorAtivo,
} from "@/backend/jobs-atrasados.functions";
import { runMotorAutomacoes } from "@/backend/motor.functions";
import { getErrosRecentesPorTipo, type ErroPorTipo } from "@/backend/caixa-saida.functions";
import { Loader2, RefreshCw, AlertTriangle, Power, PowerOff, Trash2, Clock, Play } from "lucide-react";

type Resumo = Awaited<ReturnType<typeof getJobsAtrasadosResumo>>;
type Job = Awaited<ReturnType<typeof listarJobsAtrasados>>[number];

export function AtrasadosTab() {
  const fnResumo = useServerFn(getJobsAtrasadosResumo);
  const fnLista = useServerFn(listarJobsAtrasados);
  const fnDescartar = useServerFn(descartarJobsAtrasados);
  const fnReagendar = useServerFn(reagendarJobsHorarioComercial);
  const fnSetAtivo = useServerFn(setMotorAtivo);
  const fnRun = useServerFn(runMotorAutomacoes);
  const fnErros = useServerFn(getErrosRecentesPorTipo);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [erros, setErros] = useState<ErroPorTipo[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [apagandoLote, setApagandoLote] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, l, e] = await Promise.all([fnResumo(), fnLista(), fnErros()]);
      setResumo(r);
      setJobs(l);
      setErros(e);
      setSelecionados(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const totalAtrasados = resumo?.resumo.reduce((s, r) => s + r.atrasados, 0) ?? 0;
  const totalPendentes = resumo?.resumo.reduce((s, r) => s + r.total, 0) ?? 0;

  async function handleDispararTodos() {
    if (!confirm(`Disparar AGORA todos os ${totalAtrasados} jobs atrasados? Isso vai enviar mensagens reais.`)) return;
    setActing(true);
    try {
      const r = await fnRun({ data: { force: true } });
      toast.success(`Motor executado: ${r.ok} ok, ${r.fail} falhas (de ${r.processados} processados)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally { setActing(false); }
  }

  async function handleDescartar() {
    if (!confirm("Descartar todos os jobs atrasados há mais de 3 dias?")) return;
    setActing(true);
    try {
      const r = await fnDescartar({ data: { dias: 3 } });
      toast.success(`${r.descartados} jobs descartados`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally { setActing(false); }
  }

  async function handleReagendar() {
    if (!confirm("Reagendar todos os jobs atrasados para o próximo horário comercial (09–18h, dias úteis)?")) return;
    setActing(true);
    try {
      const r = await fnReagendar();
      toast.success(`${r.reagendados} jobs reagendados`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally { setActing(false); }
  }

  async function handleToggleMotor() {
    const novo = !(resumo?.motor_ativo ?? false);
    if (novo && totalAtrasados > 0) {
      if (!confirm(`Você tem ${totalAtrasados} jobs atrasados. Recomendado tratá-los antes de ligar o motor. Ligar mesmo assim?`)) return;
    }
    setActing(true);
    try {
      await fnSetAtivo({ data: { ativo: novo } });
      toast.success(novo ? "Motor ATIVADO" : "Motor DESATIVADO");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally { setActing(false); }
  }

  function toggleOne(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelecionados((prev) => {
      if (prev.size === jobs.length) return new Set();
      return new Set(jobs.map((j) => j.id));
    });
  }

  async function apagarSelecionados() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;
    if (!confirm(`Apagar ${ids.length} job(s) selecionado(s)? Essa ação não pode ser desfeita.`)) return;
    setApagandoLote(true);
    try {
      const { error } = await supabase.from("jobs_disparos").delete().in("id", ids);
      if (error) {
        toast.error("Falha ao apagar: " + error.message);
      } else {
        toast.success(`${ids.length} job(s) apagado(s)`);
        await load();
      }
    } finally {
      setApagandoLote(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-10 text-center"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando…</div>;
  }

  const ativo = resumo?.motor_ativo ?? false;

  return (
    <div className="space-y-5">
      {/* Status do motor */}
      <div className={`rounded-lg border p-4 flex items-center gap-3 ${ativo ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
        {ativo ? <Power className="h-5 w-5 text-primary" /> : <PowerOff className="h-5 w-5 text-destructive" />}
        <div className="flex-1">
          <div className="text-sm font-semibold">
            Motor de automações: {ativo ? "ATIVO" : "DESATIVADO"}
          </div>
          <div className="text-xs text-muted-foreground">
            {ativo
              ? "O cron está executando jobs pendentes a cada 5 minutos."
              : "Nenhum job está sendo disparado. Trate os atrasados antes de reativar."}
          </div>
        </div>
        <button
          onClick={handleToggleMotor}
          disabled={acting}
          className={`text-sm px-3 py-2 rounded-md font-medium ${ativo ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"} disabled:opacity-50`}
        >
          {ativo ? "Desativar motor" : "Ativar motor"}
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Pendentes" value={totalPendentes} />
        <Stat label="Atrasados" value={totalAtrasados} highlight={totalAtrasados > 0} />
        <Stat label="Tipos distintos" value={resumo?.resumo.length ?? 0} />
      </div>

      {/* Tabela por tipo */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Resumo por tipo</div>
          <button onClick={() => void load()} className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Tipo</th>
              <th className="text-right font-medium">Pendentes</th>
              <th className="text-right font-medium">Atrasados</th>
              <th className="text-left pl-6 font-medium">Mais antigo</th>
            </tr>
          </thead>
          <tbody>
            {(resumo?.resumo ?? []).length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhum job pendente.</td></tr>
            ) : resumo!.resumo.map((r) => (
              <tr key={r.tipo} className="border-b border-border/40">
                <td className="px-4 py-2"><code className="text-xs">{r.tipo}</code></td>
                <td className="text-right">{r.total}</td>
                <td className={`text-right ${r.atrasados > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {r.atrasados}
                </td>
                <td className="pl-6 text-xs text-muted-foreground">
                  {r.mais_antigo ? new Date(r.mais_antigo).toLocaleString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ações sobre atrasados */}
      {totalAtrasados > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold mb-1">Decida o que fazer com os {totalAtrasados} jobs atrasados</div>
              <p className="text-xs text-muted-foreground">
                Escolha uma ação antes de reativar o motor. Você pode combinar (ex: descartar antigos depois reagendar o resto).
              </p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <button
              onClick={handleDispararTodos}
              disabled={acting}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Disparar todos agora
            </button>
            <button
              onClick={handleDescartar}
              disabled={acting}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Descartar atrasados &gt; 3 dias
            </button>
            <button
              onClick={handleReagendar}
              disabled={acting}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <Clock className="h-4 w-4" /> Reagendar p/ horário comercial
            </button>
          </div>
        </div>
      )}

      {/* Lista detalhada */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">
            Jobs atrasados (até 200)
            {selecionados.size > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""})
              </span>
            )}
          </div>
          <button
            onClick={() => void apagarSelecionados()}
            disabled={apagandoLote || selecionados.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50"
          >
            {apagandoLote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Apagar selecionados
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="w-8 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={jobs.length > 0 && selecionados.size === jobs.length}
                    ref={(el) => { if (el) el.indeterminate = selecionados.size > 0 && selecionados.size < jobs.length; }}
                    onChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="text-left px-4 py-2 font-medium">Aluno</th>
                <th className="text-left font-medium">Tipo</th>
                <th className="text-left font-medium">Agendado para</th>
                <th className="text-right pr-4 font-medium">Tentativas</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum job atrasado.</td></tr>
              ) : jobs.map((j) => (
                <tr key={j.id} className="border-b border-border/40">
                  <td className="px-3 text-center">
                    <input
                      type="checkbox"
                      checked={selecionados.has(j.id)}
                      onChange={() => toggleOne(j.id)}
                      aria-label={`Selecionar job ${j.id}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-xs">{j.aluno_nome ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-xs"><code className="text-[11px]">{j.tipo}</code></td>
                  <td className="text-xs text-muted-foreground">{new Date(j.agendado_para).toLocaleString("pt-BR")}</td>
                  <td className="pr-4 text-right text-xs">{j.tentativas ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Erros recentes por tipo (48h) */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-semibold flex items-center justify-between">
          <span>Erros recentes por tipo (48h)</span>
          <span className="text-xs text-muted-foreground">{erros.reduce((s, e) => s + e.qtd, 0)} erros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Tipo</th>
                <th className="text-right font-medium">Qtd</th>
                <th className="text-left pl-6 font-medium">Último erro</th>
                <th className="text-left pl-6 font-medium">Aluno mais recente</th>
              </tr>
            </thead>
            <tbody>
              {erros.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhum erro nas últimas 48h. 🎉</td></tr>
              ) : erros.map((e) => (
                <tr key={e.tipo} className="border-b border-border/40 align-top">
                  <td className="px-4 py-2 text-xs"><code className="text-[11px]">{e.tipo}</code></td>
                  <td className="text-right text-xs font-semibold text-destructive">{e.qtd}</td>
                  <td className="pl-6 text-xs text-muted-foreground max-w-[420px] truncate" title={e.ultimo_erro}>{e.ultimo_erro}</td>
                  <td className="pl-6 text-xs">
                    {e.ultimo_aluno_id ? (
                      <Link to="/alunos/$id" params={{ id: e.ultimo_aluno_id }} className="text-primary hover:underline">
                        {e.ultimo_aluno_nome ?? e.ultimo_aluno_id.slice(0, 8)}
                      </Link>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-3 ${highlight ? "border-destructive/40" : "border-border"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}