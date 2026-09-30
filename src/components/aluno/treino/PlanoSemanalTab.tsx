import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  CalendarDays,
  Library,
  X,
  Sparkles,
  GripVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  TIPOS_SESSAO,
  TIPOS_BLOCO,
  TIPOS_SEMANA,
  DIAS_SEMANA,
  tipoSessaoMeta,
  type SessaoTipo,
  type BlocoTipo,
} from "@/lib/corrida-tipos";
import {
  inicioDaSemana,
  toISODate,
  addDays,
  numeroSemanaIso,
  descreverZona,
  paceToKmh,
  type PerfilCorrida,
} from "@/lib/corrida-zonas";
import { BibliotecaSessoesTab, type ModeloSessao } from "./BibliotecaSessoesTab";
import { WizardGerarPlano } from "./WizardGerarPlano";
import type { ParamsGeracao, SemanaGerada } from "@/lib/corrida-gerador";

type Sessao = {
  id: string;
  data: string; // iso
  ordem_no_dia: number;
  tipo: SessaoTipo;
  nome: string;
  duracao_min: number | null;
  distancia_km: number | null;
  pace_alvo: string | null;
  zona_fc: string | null;
  objetivo: string | null;
  observacao: string | null;
  executada: boolean;
  blocos: Bloco[];
};

type Bloco = {
  id: string;
  ordem: number;
  tipo: BlocoTipo;
  nome: string;
  descricao: string;
  duracao_min: string;
  pace: string;
  zona: string;
  series: string;
  distancia_serie: string;
  recuperacao: string;
};

type Microciclo = {
  id: string | null;
  data_inicio: string;
  numero_semana: number;
  tipo_semana: string;
  volume_alvo_km: string;
  objetivo: string;
  observacao: string;
  status: "rascunho" | "publicada";
};

function novaSessao(data: string, tipo: SessaoTipo = "rodagem" as SessaoTipo): Sessao {
  const meta = tipoSessaoMeta(tipo);
  return {
    id: `tmp_${Math.random().toString(36).slice(2, 9)}`,
    data,
    ordem_no_dia: 0,
    tipo,
    nome: meta.label,
    duracao_min: null,
    distancia_km: null,
    pace_alvo: null,
    zona_fc: null,
    objetivo: null,
    observacao: null,
    executada: false,
    blocos: [],
  };
}

function novoBloco(tipo: BlocoTipo = "rodagem"): Bloco {
  return {
    id: `tmp_${Math.random().toString(36).slice(2, 9)}`,
    ordem: 0,
    tipo,
    nome: TIPOS_BLOCO.find((t) => t.value === tipo)?.label ?? "Bloco",
    descricao: "",
    duracao_min: "",
    pace: "",
    zona: "Z2",
    series: "",
    distancia_serie: "",
    recuperacao: "",
  };
}

export function PlanoSemanalTab({ alunoId, perfil }: { alunoId: string; perfil: PerfilCorrida }) {
  const { crmUser, canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [semanaRef, setSemanaRef] = useState<Date>(() => inicioDaSemana(new Date()));
  const [micro, setMicro] = useState<Microciclo>(() => ({
    id: null,
    data_inicio: toISODate(inicioDaSemana(new Date())),
    numero_semana: numeroSemanaIso(new Date()),
    tipo_semana: "normal",
    volume_alvo_km: "",
    objetivo: "",
    observacao: "",
    status: "rascunho",
  }));
  const [sessoes, setSessoes] = useState<Sessao[]>([]);

  const [sessaoAberta, setSessaoAberta] = useState<Sessao | null>(null);
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false);
  const [wizardAberto, setWizardAberto] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const carregar = useCallback(async () => {
    setLoading(true);
    const dataInicioIso = toISODate(semanaRef);

    const { data: m } = await supabase
      .from("corrida_microciclos")
      .select("*")
      .eq("aluno_id", alunoId)
      .eq("data_inicio", dataInicioIso)
      .maybeSingle();

    if (m) {
      setMicro({
        id: m.id,
        data_inicio: m.data_inicio,
        numero_semana: m.numero_semana ?? numeroSemanaIso(semanaRef),
        tipo_semana: m.tipo_semana ?? "normal",
        volume_alvo_km: m.volume_alvo_km != null ? String(m.volume_alvo_km) : "",
        objetivo: m.objetivo ?? "",
        observacao: m.observacao ?? "",
        status: (m.status as "rascunho" | "publicada") ?? "rascunho",
      });

      const { data: ss } = await supabase
        .from("corrida_sessoes")
        .select("*, corrida_sessao_blocos(*)")
        .eq("microciclo_id", m.id)
        .order("data", { ascending: true })
        .order("ordem_no_dia", { ascending: true });

      if (ss) {
        setSessoes(
          ss.map((s) => ({
            id: s.id,
            data: s.data,
            ordem_no_dia: s.ordem_no_dia,
            tipo: s.tipo as SessaoTipo,
            nome: s.nome,
            duracao_min: s.duracao_min,
            distancia_km: s.distancia_km != null ? Number(s.distancia_km) : null,
            pace_alvo: s.pace_alvo,
            zona_fc: s.zona_fc,
            objetivo: s.objetivo,
            observacao: s.observacao,
            executada: s.executada,
            blocos: ((s as { corrida_sessao_blocos?: Array<Record<string, unknown>> }).corrida_sessao_blocos ?? [])
              .map(
                (b) =>
                  ({
                    id: String(b.id),
                    ordem: Number(b.ordem ?? 0),
                    tipo: (b.tipo as BlocoTipo) ?? "rodagem",
                    nome: String(b.nome ?? ""),
                    descricao: String(b.descricao ?? ""),
                    duracao_min: b.duracao_min != null ? String(b.duracao_min) : "",
                    pace: String(b.pace ?? ""),
                    zona: String(b.zona ?? "Z2"),
                    series: String(b.series ?? ""),
                    distancia_serie: String(b.distancia_serie ?? ""),
                    recuperacao: String(b.recuperacao ?? ""),
                  }) as Bloco,
              )
              .sort((a, b) => a.ordem - b.ordem),
          })),
        );
      } else {
        setSessoes([]);
      }
    } else {
      setMicro({
        id: null,
        data_inicio: dataInicioIso,
        numero_semana: numeroSemanaIso(semanaRef),
        tipo_semana: "normal",
        volume_alvo_km: "",
        objetivo: "",
        observacao: "",
        status: "rascunho",
      });
      setSessoes([]);
    }
    setLoading(false);
  }, [alunoId, semanaRef]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ===== KPIs =====
  const totalKm = useMemo(
    () => sessoes.reduce((acc, s) => acc + (s.distancia_km ?? 0), 0),
    [sessoes],
  );
  const totalMin = useMemo(
    () => sessoes.reduce((acc, s) => acc + (s.duracao_min ?? 0), 0),
    [sessoes],
  );
  const qualidadeKm = useMemo(
    () =>
      sessoes
        .filter((s) => ["intervalado", "tempo", "fartlek"].includes(s.tipo))
        .reduce((acc, s) => acc + (s.distancia_km ?? 0), 0),
    [sessoes],
  );
  const pctQualidade = totalKm > 0 ? Math.round((qualidadeKm / totalKm) * 100) : 0;
  const diasComTreino = new Set(sessoes.filter((s) => s.tipo !== "descanso").map((s) => s.data)).size;

  // ===== Mutações locais =====
  function adicionarSessao(dataIso: string, tipo: SessaoTipo = "regenerativo") {
    const nova = { ...novaSessao(dataIso, tipo), ordem_no_dia: sessoes.filter((s) => s.data === dataIso).length };
    setSessoes((prev) => [...prev, nova]);
    setSessaoAberta(nova);
  }

  function atualizarSessao(id: string, patch: Partial<Sessao>) {
    setSessoes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    if (sessaoAberta?.id === id) setSessaoAberta((s) => (s ? { ...s, ...patch } : s));
  }

  function removerSessao(id: string) {
    setSessoes((prev) => prev.filter((s) => s.id !== id));
    if (sessaoAberta?.id === id) setSessaoAberta(null);
  }

  function duplicarSessao(id: string) {
    const s = sessoes.find((x) => x.id === id);
    if (!s) return;
    const clone: Sessao = {
      ...s,
      id: `tmp_${Math.random().toString(36).slice(2, 9)}`,
      ordem_no_dia: sessoes.filter((x) => x.data === s.data).length,
      blocos: s.blocos.map((b) => ({ ...b, id: `tmp_${Math.random().toString(36).slice(2, 9)}` })),
    };
    setSessoes((prev) => [...prev, clone]);
  }

  function moverSessao(id: string, novaDataIso: string) {
    setSessoes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.data === novaDataIso) return s;
        return { ...s, data: novaDataIso, ordem_no_dia: prev.filter((x) => x.data === novaDataIso && x.id !== id).length };
      }),
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    const sessaoId = e.active.id as string;
    const novaData = e.over?.id as string | undefined;
    if (!novaData) return;
    moverSessao(sessaoId, novaData);
  }

  async function gerarPlanoHandler(params: ParamsGeracao, semanas: SemanaGerada[]) {
    if (!canEdit) {
      toast.error("Sem permissão para editar");
      return;
    }
    if (semanas.length === 0) {
      toast.error("Nada para gerar");
      return;
    }
    setSaving(true);
    try {
      // Cria macrociclo se escopo > semana
      let macroId: string | null = null;
      if (params.escopo !== "semana") {
        const { data, error } = await supabase
          .from("corrida_macrociclos")
          .insert([
            {
              aluno_id: alunoId,
              nome:
                params.provaNome ??
                (params.escopo === "mesociclo" ? "Mesociclo" : "Macrociclo"),
              data_inicio: semanas[0].data_inicio,
              data_fim: toISODate(addDays(new Date(semanas[semanas.length - 1].data_inicio + "T00:00"), 6)),
              semanas_total: semanas.length,
              modelo_periodizacao: params.modelo,
              volume_base_km: params.volumeBaseKm,
              volume_pico_km: params.volumePicoKm,
              prova_nome: params.provaNome ?? null,
              prova_data: params.provaData ?? null,
              prova_distancia_km: params.provaDistanciaKm ?? null,
              params_geracao: JSON.parse(JSON.stringify(params)),
              status: "rascunho",
              criado_por: crmUser?.nome ?? crmUser?.email ?? null,
            },
          ])
          .select("id")
          .single();
        if (error) throw error;
        macroId = data.id;
      }

      // Para cada semana: upsert microciclo + replace sessões
      for (const sem of semanas) {
        // Apaga microciclo existente na mesma data
        const { data: existente } = await supabase
          .from("corrida_microciclos")
          .select("id")
          .eq("aluno_id", alunoId)
          .eq("data_inicio", sem.data_inicio)
          .maybeSingle();
        if (existente) {
          await supabase.from("corrida_sessoes").delete().eq("microciclo_id", existente.id);
          await supabase.from("corrida_microciclos").delete().eq("id", existente.id);
        }

        const { data: novoMicro, error: errMicro } = await supabase
          .from("corrida_microciclos")
          .insert([
            {
              aluno_id: alunoId,
              data_inicio: sem.data_inicio,
              numero_semana: sem.numero_semana,
              tipo_semana: sem.tipo_semana,
              volume_alvo_km: sem.volume_alvo_km,
              objetivo: sem.objetivo || null,
              status: "rascunho",
              macrociclo_id: macroId,
              ordem_no_macro: sem.ordem_no_macro,
              params_geracao: JSON.parse(JSON.stringify(params)),
              criado_por: crmUser?.nome ?? crmUser?.email ?? null,
            },
          ])
          .select("id")
          .single();
        if (errMicro) throw errMicro;

        if (sem.sessoes.length > 0) {
          const { error: errSess } = await supabase.from("corrida_sessoes").insert(
            sem.sessoes.map((s, i) => ({
              microciclo_id: novoMicro.id,
              aluno_id: alunoId,
              data: s.data,
              ordem_no_dia: i,
              tipo: s.tipo,
              nome: s.nome,
              duracao_min: s.duracao_min,
              distancia_km: s.distancia_km,
              pace_alvo: s.pace_alvo,
              zona_fc: s.zona_fc,
              objetivo: s.objetivo,
            })),
          );
          if (errSess) throw errSess;
        }
      }

      toast.success(
        params.escopo === "semana"
          ? "Semana gerada!"
          : `${semanas.length} semanas geradas!`,
      );

      // Navega para a primeira semana gerada
      setSemanaRef(inicioDaSemana(new Date(semanas[0].data_inicio + "T00:00")));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar plano");
    } finally {
      setSaving(false);
    }
  }


  function aplicarModelo(modelo: ModeloSessao, dataIso?: string) {
    const targetData = dataIso ?? sessaoAberta?.data ?? toISODate(semanaRef);
    const blocos: Bloco[] = (modelo.blocos ?? []).map((b, i) => ({
      id: `tmp_${Math.random().toString(36).slice(2, 9)}`,
      ordem: i,
      tipo: (b.tipo as BlocoTipo) ?? "rodagem",
      nome: String(b.nome ?? TIPOS_BLOCO.find((t) => t.value === (b.tipo as BlocoTipo))?.label ?? "Bloco"),
      descricao: String(b.descricao ?? ""),
      duracao_min: String(b.duracao_min ?? ""),
      pace: String(b.pace ?? ""),
      zona: String(b.zona ?? "Z2"),
      series: String(b.series ?? ""),
      distancia_serie: String(b.distancia_serie ?? ""),
      recuperacao: String(b.recuperacao ?? ""),
    }));
    const nova: Sessao = {
      ...novaSessao(targetData, modelo.tipo),
      nome: modelo.nome,
      duracao_min: modelo.duracao_min,
      distancia_km: modelo.distancia_km != null ? Number(modelo.distancia_km) : null,
      pace_alvo: modelo.pace_alvo,
      zona_fc: modelo.zona_fc,
      objetivo: modelo.objetivo,
      ordem_no_dia: sessoes.filter((s) => s.data === targetData).length,
      blocos,
    };
    setSessoes((prev) => [...prev, nova]);
    setSessaoAberta(nova);
    setBibliotecaAberta(false);
    toast.success(`Modelo "${modelo.nome}" aplicado`);
  }

  // ===== Salvar =====
  async function salvar() {
    if (!canEdit) {
      toast.error("Sem permissão para editar");
      return;
    }
    setSaving(true);
    try {
      let microId = micro.id;
      const payloadMicro = {
        aluno_id: alunoId,
        data_inicio: micro.data_inicio,
        numero_semana: micro.numero_semana,
        tipo_semana: micro.tipo_semana,
        volume_alvo_km: micro.volume_alvo_km ? Number(micro.volume_alvo_km) : null,
        objetivo: micro.objetivo.trim() || null,
        observacao: micro.observacao.trim() || null,
        status: micro.status,
        criado_por: crmUser?.nome ?? crmUser?.email ?? null,
      };

      if (microId) {
        const { error } = await supabase.from("corrida_microciclos").update(payloadMicro).eq("id", microId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("corrida_microciclos")
          .insert(payloadMicro)
          .select("id")
          .single();
        if (error) throw error;
        microId = data.id;
      }

      // Replace strategy: delete all sessoes do microciclo e reinsere
      const { error: delErr } = await supabase
        .from("corrida_sessoes")
        .delete()
        .eq("microciclo_id", microId);
      if (delErr) throw delErr;

      for (const s of sessoes) {
        const { data: sessRow, error: sErr } = await supabase
          .from("corrida_sessoes")
          .insert({
            microciclo_id: microId,
            aluno_id: alunoId,
            data: s.data,
            ordem_no_dia: s.ordem_no_dia,
            tipo: s.tipo,
            nome: s.nome,
            duracao_min: s.duracao_min,
            distancia_km: s.distancia_km,
            pace_alvo: s.pace_alvo,
            zona_fc: s.zona_fc,
            objetivo: s.objetivo,
            observacao: s.observacao,
          })
          .select("id")
          .single();
        if (sErr) throw sErr;
        if (s.blocos.length > 0) {
          const { error: bErr } = await supabase.from("corrida_sessao_blocos").insert(
            s.blocos.map((b, i) => ({
              sessao_id: sessRow.id,
              ordem: i,
              tipo: b.tipo,
              nome: b.nome,
              descricao: b.descricao || null,
              duracao_min: b.duracao_min || null,
              pace: b.pace || null,
              zona: b.zona || null,
              series: b.series || null,
              distancia_serie: b.distancia_serie || null,
              recuperacao: b.recuperacao || null,
            })),
          );
          if (bErr) throw bErr;
        }
      }

      toast.success("Semana salva!");
      await carregar();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  // ===== Navegação =====
  function semanaAnterior() {
    setSemanaRef((d) => addDays(d, -7));
  }
  function semanaProxima() {
    setSemanaRef((d) => addDays(d, 7));
  }
  function semanaAtual() {
    setSemanaRef(inicioDaSemana(new Date()));
  }

  const volumeAlvoNum = micro.volume_alvo_km ? Number(micro.volume_alvo_km) : 0;
  const acimaAlvo = volumeAlvoNum > 0 && totalKm > volumeAlvoNum * 1.1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando semana...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header da semana */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={semanaAnterior}
            className="h-9 w-9 rounded-lg bg-muted hover:bg-muted/70 flex items-center justify-center"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-muted-foreground">
              SEMANA {micro.numero_semana}
            </p>
            <p className="text-sm font-bold">
              {new Date(micro.data_inicio + "T00:00").toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}{" "}
              –{" "}
              {addDays(new Date(micro.data_inicio + "T00:00"), 6).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={semanaProxima}
            className="h-9 w-9 rounded-lg bg-muted hover:bg-muted/70 flex items-center justify-center"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={semanaAtual}
            className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Hoje
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Tipo de semana">
            <select
              value={micro.tipo_semana}
              onChange={(e) => setMicro((m) => ({ ...m, tipo_semana: e.target.value }))}
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
            >
              {TIPOS_SEMANA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Volume alvo (km)">
            <input
              type="number"
              value={micro.volume_alvo_km}
              onChange={(e) => setMicro((m) => ({ ...m, volume_alvo_km: e.target.value }))}
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
              placeholder="45"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Objetivo da semana">
            <input
              value={micro.objetivo}
              onChange={(e) => setMicro((m) => ({ ...m, objetivo: e.target.value }))}
              placeholder="Ex: Aumentar volume, manter base, choque de qualidade..."
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Kpi label="Sessões" value={String(sessoes.length)} />
          <Kpi label="Dias" value={`${diasComTreino}/7`} />
          <Kpi label="Volume" value={`${totalKm.toFixed(1)} km`} />
          <Kpi label="Tempo" value={`${Math.round(totalMin / 60)}h ${totalMin % 60}min`} />
        </div>

        {/* Alertas */}
        <div className="mt-3 space-y-1.5">
          {acimaAlvo && (
            <Alerta
              icon={AlertTriangle}
              cor="#F97316"
              texto={`Volume (${totalKm.toFixed(1)}km) está 10% acima do alvo (${volumeAlvoNum}km)`}
            />
          )}
          {pctQualidade > 25 && (
            <Alerta
              icon={AlertTriangle}
              cor="#F97316"
              texto={`${pctQualidade}% do volume em qualidade — atenção à regra 80/20`}
            />
          )}
          {pctQualidade > 0 && pctQualidade <= 25 && (
            <Alerta
              icon={CheckCircle2}
              cor="#22C55E"
              texto={`Distribuição saudável: ${100 - pctQualidade}% easy / ${pctQualidade}% qualidade`}
            />
          )}
          {sessoes.length === 0 && (
            <Alerta icon={TrendingUp} cor="#0033FF" texto="Comece adicionando sessões nos dias da semana abaixo." />
          )}
        </div>
      </section>

      {/* Grid 7 dias com drag-and-drop */}
      <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const data = addDays(new Date(micro.data_inicio + "T00:00"), i);
              const iso = toISODate(data);
              const doDia = sessoes.filter((s) => s.data === iso);
              const isHoje = iso === toISODate(new Date());
              return (
                <DiaColuna
                  key={iso}
                  iso={iso}
                  diaNome={DIAS_SEMANA[i]}
                  diaNum={data.getDate()}
                  isHoje={isHoje}
                  sessoes={doDia}
                  onAdd={() => adicionarSessao(iso)}
                  onAbrir={(s) => setSessaoAberta(s)}
                  onDuplicar={duplicarSessao}
                  onRemover={removerSessao}
                />
              );
            })}
          </div>
        </DndContext>
        <p className="mt-2 text-[10px] text-muted-foreground text-center">
          💡 Arraste sessões entre os dias para reorganizar
        </p>
      </section>

      {/* Observação geral */}
      <section
        className="rounded-xl bg-card p-5 shadow-sm border border-border"
        style={{ borderLeft: "4px solid hsl(var(--primary))" }}
      >
        <label className="block text-sm font-semibold mb-2">Observação geral para o aluno</label>
        <textarea
          value={micro.observacao}
          onChange={(e) => setMicro((m) => ({ ...m, observacao: e.target.value }))}
          rows={3}
          placeholder="Mensagem e orientações que aparecerão no app do aluno..."
          className="w-full rounded-lg bg-muted/40 focus:bg-background border border-input px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </section>

      {/* Ações */}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setWizardAberto(true)}
          disabled={!canEdit}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          Gerar plano
        </button>
        <button
          type="button"
          onClick={() => setBibliotecaAberta(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
        >
          <Library className="h-4 w-4" />
          Aplicar modelo
        </button>
        <button
          type="button"
          onClick={() => setMicro((m) => ({ ...m, status: m.status === "publicada" ? "rascunho" : "publicada" }))}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
        >
          {micro.status === "publicada" ? "Marcar como rascunho" : "Marcar como publicada"}
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={saving || !canEdit}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar semana
        </button>
      </div>

      {/* Wizard de geração */}
      <WizardGerarPlano
        aberto={wizardAberto}
        onClose={() => setWizardAberto(false)}
        semanaInicio={micro.data_inicio}
        perfil={perfil}
        onGerar={gerarPlanoHandler}
      />

      {/* Sheet de edição de sessão */}
      <Sheet open={!!sessaoAberta} onOpenChange={(o) => !o && setSessaoAberta(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {sessaoAberta && (
            <SessaoEditor
              sessao={sessaoAberta}
              perfil={perfil}
              onChange={(patch) => atualizarSessao(sessaoAberta.id, patch)}
              onRemove={() => removerSessao(sessaoAberta.id)}
              onAplicarModelo={() => setBibliotecaAberta(true)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet biblioteca */}
      <Sheet open={bibliotecaAberta} onOpenChange={setBibliotecaAberta}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Biblioteca de sessões</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <BibliotecaSessoesTab onAplicar={(m) => aplicarModelo(m)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SessaoEditor({
  sessao,
  perfil,
  onChange,
  onRemove,
  onAplicarModelo,
}: {
  sessao: Sessao;
  perfil: PerfilCorrida;
  onChange: (patch: Partial<Sessao>) => void;
  onRemove: () => void;
  onAplicarModelo: () => void;
}) {
  const meta = tipoSessaoMeta(sessao.tipo);
  const Icon = meta.Icon;
  const dataFmt = new Date(sessao.data + "T00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });

  function setBlocos(blocos: Bloco[]) {
    onChange({ blocos });
  }
  function addBloco() {
    setBlocos([...sessao.blocos, { ...novoBloco(), ordem: sessao.blocos.length }]);
  }
  function updateBloco(id: string, patch: Partial<Bloco>) {
    setBlocos(sessao.blocos.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function removeBloco(id: string) {
    setBlocos(sessao.blocos.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-4">
      <SheetHeader>
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${meta.cor}1A`, color: meta.cor }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base capitalize">{dataFmt}</SheetTitle>
            <p className="text-xs text-muted-foreground capitalize">{meta.label}</p>
          </div>
          <button
            type="button"
            onClick={onAplicarModelo}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1.5 text-xs font-semibold"
          >
            <Library className="h-3.5 w-3.5" />
            Modelo
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Remover sessão"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </SheetHeader>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select
              value={sessao.tipo}
              onChange={(e) => onChange({ tipo: e.target.value as SessaoTipo })}
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
            >
              {TIPOS_SESSAO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nome">
            <input
              value={sessao.nome}
              onChange={(e) => onChange({ nome: e.target.value })}
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Duração (min)">
            <input
              type="number"
              value={sessao.duracao_min ?? ""}
              onChange={(e) => onChange({ duracao_min: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
              placeholder="50"
            />
          </Field>
          <Field label="Distância (km)">
            <input
              type="number"
              step="0.1"
              value={sessao.distancia_km ?? ""}
              onChange={(e) => onChange({ distancia_km: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
              placeholder="10"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Pace alvo">
            <input
              value={sessao.pace_alvo ?? ""}
              onChange={(e) => onChange({ pace_alvo: e.target.value })}
              placeholder="5:30/km"
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
            />
            {(() => {
              const kmh = paceToKmh(sessao.pace_alvo);
              return kmh ? (
                <span className="text-[10px] text-muted-foreground mt-1">
                  Esteira: {kmh.toFixed(1).replace(".", ",")} km/h
                </span>
              ) : null;
            })()}
          </Field>
          <Field label="Zona FC">
            <select
              value={sessao.zona_fc ?? ""}
              onChange={(e) => onChange({ zona_fc: e.target.value || null })}
              className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {(["Z1", "Z2", "Z3", "Z4", "Z5"] as const).map((z) => (
                <option key={z} value={z}>
                  {descreverZona(perfil, z)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Objetivo">
          <input
            value={sessao.objetivo ?? ""}
            onChange={(e) => onChange({ objetivo: e.target.value })}
            placeholder="Ex: Base aeróbica"
            className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Observação para o aluno">
          <textarea
            value={sessao.observacao ?? ""}
            onChange={(e) => onChange({ observacao: e.target.value })}
            rows={2}
            className="w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm resize-y"
          />
        </Field>
      </section>

      {/* Blocos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Blocos da sessão</h4>
          <span className="text-xs text-muted-foreground">{sessao.blocos.length}</span>
        </div>
        <div className="space-y-2">
          {sessao.blocos.map((b) => (
            <BlocoEditor key={b.id} bloco={b} onChange={(p) => updateBloco(b.id, p)} onRemove={() => removeBloco(b.id)} />
          ))}
          <button
            type="button"
            onClick={addBloco}
            className="w-full rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 py-3 inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Adicionar bloco
          </button>
        </div>
      </section>
    </div>
  );
}

function BlocoEditor({
  bloco,
  onChange,
  onRemove,
}: {
  bloco: Bloco;
  onChange: (p: Partial<Bloco>) => void;
  onRemove: () => void;
}) {
  const isInter = bloco.tipo === "intervalado" || bloco.tipo === "strides";
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={bloco.tipo}
          onChange={(e) => onChange({ tipo: e.target.value as BlocoTipo })}
          className="text-xs font-semibold bg-transparent border-0 focus:outline-none cursor-pointer"
        >
          {TIPOS_BLOCO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={bloco.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          className="flex-1 bg-transparent text-sm font-semibold focus:outline-none border-b border-transparent focus:border-primary/40 px-1"
        />
        <button
          type="button"
          onClick={onRemove}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <textarea
        value={bloco.descricao}
        onChange={(e) => onChange({ descricao: e.target.value })}
        rows={1}
        placeholder="Descrição..."
        className="w-full rounded-md bg-muted/30 border border-input px-2 py-1.5 text-xs resize-y"
      />

      <div className="grid grid-cols-3 gap-2">
        <Mini label="Duração">
          <input
            value={bloco.duracao_min}
            onChange={(e) => onChange({ duracao_min: e.target.value })}
            placeholder="10"
            className="w-full bg-muted/30 border border-input rounded px-2 py-1 text-xs"
          />
        </Mini>
        <Mini label="Pace">
          <input
            value={bloco.pace}
            onChange={(e) => onChange({ pace: e.target.value })}
            placeholder="5:30"
            className="w-full bg-muted/30 border border-input rounded px-2 py-1 text-xs"
          />
          {(() => {
            const kmh = paceToKmh(bloco.pace);
            return kmh ? (
              <span className="text-[9px] text-muted-foreground">{kmh.toFixed(1).replace(".", ",")} km/h</span>
            ) : null;
          })()}
        </Mini>
        <Mini label="Zona">
          <select
            value={bloco.zona}
            onChange={(e) => onChange({ zona: e.target.value })}
            className="w-full bg-muted/30 border border-input rounded px-2 py-1 text-xs"
          >
            {["Z1", "Z2", "Z3", "Z4", "Z5"].map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Mini>
      </div>

      {isInter && (
        <div className="grid grid-cols-3 gap-2">
          <Mini label="Séries">
            <input
              value={bloco.series}
              onChange={(e) => onChange({ series: e.target.value })}
              placeholder="10"
              className="w-full bg-muted/30 border border-input rounded px-2 py-1 text-xs"
            />
          </Mini>
          <Mini label="Distância">
            <input
              value={bloco.distancia_serie}
              onChange={(e) => onChange({ distancia_serie: e.target.value })}
              placeholder="400m"
              className="w-full bg-muted/30 border border-input rounded px-2 py-1 text-xs"
            />
          </Mini>
          <Mini label="Recuperação">
            <input
              value={bloco.recuperacao}
              onChange={(e) => onChange({ recuperacao: e.target.value })}
              placeholder="90s"
              className="w-full bg-muted/30 border border-input rounded px-2 py-1 text-xs"
            />
          </Mini>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-2">
      <p className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function Alerta({ icon: Icon, cor, texto }: { icon: typeof AlertTriangle; cor: string; texto: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
      style={{ backgroundColor: `${cor}14`, color: cor }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">{texto}</span>
    </div>
  );
}

// ===== DnD: coluna de dia + card draggable =====
function DiaColuna({
  iso,
  diaNome,
  diaNum,
  isHoje,
  sessoes,
  onAdd,
  onAbrir,
  onDuplicar,
  onRemover,
}: {
  iso: string;
  diaNome: string;
  diaNum: number;
  isHoje: boolean;
  sessoes: Sessao[];
  onAdd: () => void;
  onAbrir: (s: Sessao) => void;
  onDuplicar: (id: string) => void;
  onRemover: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: iso });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border ${
        isOver ? "border-primary bg-primary/5 ring-2 ring-primary/40" : isHoje ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
      } bg-background min-h-[140px] flex flex-col transition`}
    >
      <header className="px-2 py-1.5 border-b border-border bg-muted/30">
        <p className="text-[9px] font-extrabold tracking-[0.12em] text-muted-foreground text-center">{diaNome}</p>
        <p className={`text-center text-sm font-extrabold ${isHoje ? "text-primary" : "text-foreground"}`}>{diaNum}</p>
      </header>
      <div className="flex-1 p-1 space-y-1">
        {sessoes.length === 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="w-full h-full min-h-[60px] rounded-md border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition flex items-center justify-center text-muted-foreground hover:text-primary"
            aria-label="Adicionar sessão"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        {sessoes.map((s) => (
          <SessaoCard key={s.id} sessao={s} onAbrir={() => onAbrir(s)} onDuplicar={() => onDuplicar(s.id)} onRemover={() => onRemover(s.id)} />
        ))}
        {sessoes.length > 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="w-full rounded-md py-1 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 inline-flex items-center justify-center gap-1"
          >
            <Plus className="h-3 w-3" /> +
          </button>
        )}
      </div>
    </div>
  );
}

function SessaoCard({
  sessao,
  onAbrir,
  onDuplicar,
  onRemover,
}: {
  sessao: Sessao;
  onAbrir: () => void;
  onDuplicar: () => void;
  onRemover: () => void;
}) {
  const meta = tipoSessaoMeta(sessao.tipo);
  const Icon = meta.Icon;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sessao.id });
  const kmh = paceToKmh(sessao.pace_alvo);
  const style: React.CSSProperties = {
    backgroundColor: `${meta.cor}14`,
    borderLeft: `3px solid ${meta.cor}`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-md p-1.5 group relative hover:ring-1 hover:ring-primary/40 transition">
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground -ml-1"
          aria-label="Arrastar"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <Icon className="h-3 w-3 shrink-0" style={{ color: meta.cor }} />
        <span className="text-[10px] font-bold truncate flex-1" style={{ color: meta.cor }}>
          {meta.curto}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicar();
          }}
          className="opacity-0 group-hover:opacity-100 text-[8px] text-muted-foreground hover:text-primary px-1"
          aria-label="Duplicar"
        >
          ⎘
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemover();
          }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          aria-label="Remover"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <button type="button" onClick={onAbrir} className="w-full text-left">
        <p className="text-[10px] font-semibold leading-tight mt-0.5 line-clamp-2">{sessao.nome}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">
          {sessao.duracao_min ? `${sessao.duracao_min}min` : ""}
          {sessao.distancia_km ? ` · ${sessao.distancia_km}km` : ""}
        </p>
        {sessao.pace_alvo && (
          <p className="text-[9px] font-semibold mt-0.5" style={{ color: meta.cor }}>
            {sessao.pace_alvo.replace("/km", "")}/km
            {kmh ? ` · ${kmh.toFixed(1).replace(".", ",")} km/h` : ""}
          </p>
        )}
      </button>
    </div>
  );
}

