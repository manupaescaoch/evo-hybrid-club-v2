import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  GripVertical,
  Library,
  Loader2,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
  Trophy,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_HYBRID_STRUCTURE,
  HYBRID_BLOCK_TYPES,
  RESULT_TYPES,
  WORKOUT_FORMATS,
  normalizeLegacyBlockType,
  suggestRankingCriterion,
  suggestResultType,
  type HybridBlockType,
  type ResultType,
  type WorkoutFormat,
} from "@/lib/hybrid-treino";

type Visibility = {
  geral: boolean;
  unidade: boolean;
  turma: boolean;
  categoria: boolean;
  masculino: boolean;
  feminino: boolean;
  faixa_etaria: boolean;
};

type BuilderBlock = {
  id: string;
  ordem: number;
  tipo: HybridBlockType;
  nome: string;
  formato: WorkoutFormat;
  prescricao: string;
  orientacoes: string;
  resultado_habilitado: boolean;
  tipo_resultado: ResultType;
  unidade_resultado: string;
  ranking_habilitado: boolean;
  criterio_ranking: "menor" | "maior";
  visibilidade_ranking: Visibility;
  expanded: boolean;
};

type Workout = {
  id: string | null;
  nome: string;
  data: string;
  categoria: string;
  unidade: string;
  objetivo: string;
  observacoes: string;
  status: "rascunho" | "publicada";
  resultado_geral_habilitado: boolean;
  resultado_geral_tipo: ResultType;
  resultado_geral_unidade: string;
  resultado_geral_criterio: "menor" | "maior";
  blocos: BuilderBlock[];
};

const EMPTY_VISIBILITY: Visibility = {
  geral: true,
  unidade: false,
  turma: false,
  categoria: false,
  masculino: false,
  feminino: false,
  faixa_etaria: false,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function mondayOf(dateIso: string) {
  const d = new Date(dateIso + "T12:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function tempId() {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

function newBlock(tipo: HybridBlockType = "CUSTOM"): BuilderBlock {
  const label = HYBRID_BLOCK_TYPES.find(([value]) => value === tipo)?.[0] ?? tipo;
  const formato: WorkoutFormat = tipo === "STRENGTH" ? "QUALITY" : tipo === "HYROX SPECIFIC" ? "FOR TIME" : "CUSTOM";
  const resultType = suggestResultType(formato, tipo);
  return {
    id: tempId(),
    ordem: 0,
    tipo,
    nome: label,
    formato,
    prescricao: "",
    orientacoes: "",
    resultado_habilitado: false,
    tipo_resultado: resultType,
    unidade_resultado: "",
    ranking_habilitado: false,
    criterio_ranking: suggestRankingCriterion(resultType),
    visibilidade_ranking: { ...EMPTY_VISIBILITY },
    expanded: true,
  };
}

function emptyWorkout(): Workout {
  return {
    id: null,
    nome: "",
    data: today(),
    categoria: "",
    unidade: "",
    objetivo: "",
    observacoes: "",
    status: "rascunho",
    resultado_geral_habilitado: false,
    resultado_geral_tipo: "Tempo",
    resultado_geral_unidade: "",
    resultado_geral_criterio: "menor",
    blocos: [],
  };
}

export function HybridWorkoutBuilder({ alunoId }: { alunoId: string }) {
  const { crmUser, canEdit } = useAuth();
  const [workout, setWorkout] = useState<Workout>(emptyWorkout);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const blockIds = useMemo(() => workout.blocos.map((b) => b.id), [workout.blocos]);

  useEffect(() => {
    void loadDate(workout.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  async function loadDate(data: string) {
    setLoading(true);
    try {
      const sb = supabase as any;
      const { data: sessoes, error } = await sb
        .from("corrida_sessoes")
        .select("*, corrida_sessao_blocos(*)")
        .eq("aluno_id", alunoId)
        .eq("data", data)
        .order("ordem_no_dia")
        .limit(1);
      if (error) throw error;
      const row = sessoes?.[0];
      if (!row) {
        setWorkout((prev) => ({ ...emptyWorkout(), data, unidade: prev.unidade }));
        return;
      }
      const blocks = (row.corrida_sessao_blocos ?? [])
        .filter((b: any) => b.ativo !== false)
        .sort((a: any, b: any) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((b: any, index: number): BuilderBlock => {
          const tipo = normalizeLegacyBlockType(b.tipo);
          const formato = (WORKOUT_FORMATS.some(([v]) => v === b.formato) ? b.formato : "CUSTOM") as WorkoutFormat;
          const resultType = (RESULT_TYPES.includes(b.tipo_resultado) ? b.tipo_resultado : suggestResultType(formato, tipo)) as ResultType;
          return {
            id: b.id,
            ordem: index,
            tipo,
            nome: b.nome ?? tipo,
            formato,
            prescricao: b.prescricao ?? b.descricao ?? "",
            orientacoes: b.orientacoes ?? "",
            resultado_habilitado: !!b.resultado_habilitado,
            tipo_resultado: resultType,
            unidade_resultado: b.unidade_resultado ?? "",
            ranking_habilitado: !!b.ranking_habilitado,
            criterio_ranking: b.criterio_ranking === "menor" ? "menor" : suggestRankingCriterion(resultType),
            visibilidade_ranking: { ...EMPTY_VISIBILITY, ...(b.visibilidade_ranking ?? {}) },
            expanded: true,
          };
        });
      setWorkout({
        id: row.id,
        nome: row.nome ?? "",
        data,
        categoria: row.categoria ?? "",
        unidade: row.unidade ?? "",
        objetivo: row.objetivo ?? "",
        observacoes: row.observacao ?? "",
        status: row.status === "publicada" ? "publicada" : "rascunho",
        resultado_geral_habilitado: !!row.resultado_geral_habilitado,
        resultado_geral_tipo: (RESULT_TYPES.includes(row.resultado_geral_tipo) ? row.resultado_geral_tipo : "Tempo") as ResultType,
        resultado_geral_unidade: row.resultado_geral_unidade ?? "",
        resultado_geral_criterio: row.resultado_geral_criterio === "maior" ? "maior" : "menor",
        blocos: blocks,
      });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar treino");
    } finally {
      setLoading(false);
    }
  }

  function updateBlock(id: string, patch: Partial<BuilderBlock>) {
    setWorkout((w) => ({
      ...w,
      blocos: w.blocos.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function addBlock(tipo: HybridBlockType = "CUSTOM") {
    setWorkout((w) => ({
      ...w,
      blocos: [...w.blocos, { ...newBlock(tipo), ordem: w.blocos.length }],
    }));
  }

  function duplicateBlock(id: string) {
    setWorkout((w) => {
      const source = w.blocos.find((b) => b.id === id);
      if (!source) return w;
      const copy = {
        ...source,
        id: tempId(),
        nome: source.nome ? `${source.nome} — cópia` : source.tipo,
        visibilidade_ranking: { ...source.visibilidade_ranking },
      };
      const idx = w.blocos.findIndex((b) => b.id === id);
      const blocos = [...w.blocos];
      blocos.splice(idx + 1, 0, copy);
      return { ...w, blocos: blocos.map((b, i) => ({ ...b, ordem: i })) };
    });
  }

  function removeBlock(id: string) {
    setWorkout((w) => ({
      ...w,
      blocos: w.blocos.filter((b) => b.id !== id).map((b, i) => ({ ...b, ordem: i })),
    }));
  }

  function loadDefaultStructure() {
    setWorkout((w) => ({
      ...w,
      blocos: DEFAULT_HYBRID_STRUCTURE.map((tipo, i) => ({ ...newBlock(tipo), ordem: i })),
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWorkout((w) => {
      const oldIndex = w.blocos.findIndex((b) => b.id === active.id);
      const newIndex = w.blocos.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return w;
      return {
        ...w,
        blocos: arrayMove(w.blocos, oldIndex, newIndex).map((b, i) => ({ ...b, ordem: i })),
      };
    });
  }

  async function persist(status: "rascunho" | "publicada") {
    if (!canEdit) return toast.error("Sem permissão para editar");
    if (!workout.nome.trim()) return toast.error("Informe o nome do treino");
    setSaving(true);
    try {
      const sb = supabase as any;
      const week = mondayOf(workout.data);
      let { data: micro } = await sb
        .from("corrida_microciclos")
        .select("id")
        .eq("aluno_id", alunoId)
        .eq("data_inicio", week)
        .maybeSingle();
      if (!micro) {
        const { data, error } = await sb
          .from("corrida_microciclos")
          .insert({
            aluno_id: alunoId,
            data_inicio: week,
            numero_semana: 1,
            tipo_semana: "normal",
            objetivo: "HYROX / Hybrid",
            status: status === "publicada" ? "publicada" : "rascunho",
            criado_por: crmUser?.nome ?? crmUser?.email ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        micro = data;
      } else if (status === "publicada") {
        await sb.from("corrida_microciclos").update({ status: "publicada" }).eq("id", micro.id);
      }

      const sessionPayload = {
        microciclo_id: micro.id,
        aluno_id: alunoId,
        data: workout.data,
        ordem_no_dia: 0,
        tipo: "cross",
        nome: workout.nome.trim(),
        objetivo: workout.objetivo.trim() || null,
        observacao: workout.observacoes.trim() || null,
        categoria: workout.categoria.trim() || null,
        unidade: workout.unidade.trim() || null,
        treinador: crmUser?.nome ?? crmUser?.email ?? null,
        status,
        resultado_geral_habilitado: workout.resultado_geral_habilitado,
        resultado_geral_tipo: workout.resultado_geral_tipo,
        resultado_geral_unidade: workout.resultado_geral_unidade || null,
        resultado_geral_criterio: workout.resultado_geral_criterio,
      };

      let sessionId = workout.id;
      if (sessionId) {
        const { error } = await sb.from("corrida_sessoes").update(sessionPayload).eq("id", sessionId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("corrida_sessoes").insert(sessionPayload).select("id").single();
        if (error) throw error;
        sessionId = data.id;
      }

      const persistedIds = workout.blocos.filter((b) => !b.id.startsWith("tmp_")).map((b) => b.id);
      const { data: existing } = await sb
        .from("corrida_sessao_blocos")
        .select("id")
        .eq("sessao_id", sessionId);

      for (const old of existing ?? []) {
        if (!persistedIds.includes(old.id)) {
          await sb.from("corrida_sessao_blocos").update({ ativo: false }).eq("id", old.id);
        }
      }

      const nextBlocks: BuilderBlock[] = [];
      for (let i = 0; i < workout.blocos.length; i++) {
        const b = workout.blocos[i];
        const payload = {
          sessao_id: sessionId,
          ordem: i,
          tipo: b.tipo,
          nome: b.nome.trim() || b.tipo,
          descricao: b.prescricao.trim() || null,
          formato: b.formato,
          prescricao: b.prescricao.trim() || null,
          orientacoes: b.orientacoes.trim() || null,
          resultado_habilitado: b.resultado_habilitado,
          tipo_resultado: b.resultado_habilitado ? b.tipo_resultado : null,
          unidade_resultado: b.resultado_habilitado ? b.unidade_resultado || null : null,
          ranking_habilitado: b.resultado_habilitado && b.ranking_habilitado,
          criterio_ranking: b.resultado_habilitado && b.ranking_habilitado ? b.criterio_ranking : null,
          visibilidade_ranking: b.visibilidade_ranking,
          ativo: true,
        };
        if (b.id.startsWith("tmp_")) {
          const { data, error } = await sb.from("corrida_sessao_blocos").insert(payload).select("id").single();
          if (error) throw error;
          nextBlocks.push({ ...b, id: data.id, ordem: i });
        } else {
          const { error } = await sb.from("corrida_sessao_blocos").update(payload).eq("id", b.id);
          if (error) throw error;
          nextBlocks.push({ ...b, ordem: i });
        }
      }

      setWorkout((w) => ({ ...w, id: sessionId, status, blocos: nextBlocks }));
      toast.success(status === "publicada" ? "Treino publicado" : "Rascunho salvo");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao salvar treino");
    } finally {
      setSaving(false);
    }
  }

  async function saveAsTemplate() {
    if (!workout.nome.trim()) return toast.error("Informe o nome do treino");
    const sb = supabase as any;
    const { error } = await sb.from("corrida_modelos_sessao").insert({
      nome: workout.nome.trim(),
      tipo: "cross",
      descricao: workout.observacoes || null,
      objetivo: workout.objetivo || null,
      blocos: workout.blocos.map(({ expanded: _expanded, id: _id, ...b }) => b),
      tags: ["HYROX", "HYBRID"],
      criado_por: crmUser?.nome ?? crmUser?.email ?? null,
    });
    if (error) return toast.error("Erro ao salvar modelo");
    toast.success("Modelo salvo na biblioteca");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold">Treino</h2>
          <p className="text-sm text-muted-foreground">Crie e organize a sessão por blocos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadDefaultStructure} className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            Estrutura padrão
          </button>
          <button type="button" onClick={() => void saveAsTemplate()} className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted inline-flex items-center gap-2">
            <Library className="h-4 w-4" /> Salvar como modelo
          </button>
          <button type="button" onClick={() => void persist("rascunho")} disabled={saving} className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted inline-flex items-center gap-2">
            <Save className="h-4 w-4" /> Rascunho
          </button>
          <button type="button" onClick={() => void persist("publicada")} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Publicar treino
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome do treino">
            <input value={workout.nome} onChange={(e) => setWorkout((w) => ({ ...w, nome: e.target.value }))} placeholder="HYROX ENGINE #12" className="input-base" />
          </Field>
          <Field label="Data">
            <input type="date" value={workout.data} onChange={(e) => { const data = e.target.value; setWorkout((w) => ({ ...w, data })); void loadDate(data); }} className="input-base" />
          </Field>
          <Field label="Categoria / nível">
            <input value={workout.categoria} onChange={(e) => setWorkout((w) => ({ ...w, categoria: e.target.value }))} placeholder="Open · Pro · Beginner" className="input-base" />
          </Field>
          <Field label="Unidade">
            <input value={workout.unidade} onChange={(e) => setWorkout((w) => ({ ...w, unidade: e.target.value }))} placeholder="Setúbal" className="input-base" />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2 mt-3">
          <Field label="Objetivo">
            <input value={workout.objetivo} onChange={(e) => setWorkout((w) => ({ ...w, objetivo: e.target.value }))} placeholder="Ex: race pace + transições" className="input-base" />
          </Field>
          <Field label="Observações gerais">
            <input value={workout.observacoes} onChange={(e) => setWorkout((w) => ({ ...w, observacoes: e.target.value }))} placeholder="Opcional" className="input-base" />
          </Field>
        </div>
      </section>

      {loading ? (
        <div className="py-14 flex justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando treino...</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {workout.blocos.map((block, index) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  index={index}
                  onChange={(patch) => updateBlock(block.id, patch)}
                  onDuplicate={() => duplicateBlock(block.id)}
                  onRemove={() => removeBlock(block.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddBlock onAdd={addBlock} />

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Toggle
          checked={workout.resultado_geral_habilitado}
          onChange={(checked) => setWorkout((w) => ({ ...w, resultado_geral_habilitado: checked }))}
          label="Resultado geral do treino"
          description="Permite um único resultado para toda a sessão, independentemente dos blocos."
        />
        {workout.resultado_geral_habilitado && (
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Tipo de resultado">
              <select value={workout.resultado_geral_tipo} onChange={(e) => {
                const tipo = e.target.value as ResultType;
                setWorkout((w) => ({ ...w, resultado_geral_tipo: tipo, resultado_geral_criterio: suggestRankingCriterion(tipo) }));
              }} className="input-base">{RESULT_TYPES.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="Unidade">
              <input value={workout.resultado_geral_unidade} onChange={(e) => setWorkout((w) => ({ ...w, resultado_geral_unidade: e.target.value }))} placeholder="min, kg, reps..." className="input-base" />
            </Field>
            <Field label="Classificação">
              <select value={workout.resultado_geral_criterio} onChange={(e) => setWorkout((w) => ({ ...w, resultado_geral_criterio: e.target.value as "menor" | "maior" }))} className="input-base">
                <option value="menor">Menor resultado vence</option>
                <option value="maior">Maior resultado vence</option>
              </select>
            </Field>
          </div>
        )}
      </section>

      <style>{`
        .input-base { width:100%; border:1px solid hsl(var(--border)); background:hsl(var(--muted)/.35); border-radius:.6rem; padding:.55rem .7rem; font-size:.875rem; outline:none; }
        .input-base:focus { border-color:hsl(var(--primary)/.55); box-shadow:0 0 0 2px hsl(var(--primary)/.08); }
      `}</style>
    </div>
  );
}

function AddBlock({ onAdd }: { onAdd: (tipo: HybridBlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full py-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary">
        <Plus className="h-4 w-4" /> Adicionar bloco
      </button>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HYBRID_BLOCK_TYPES.map(([value, description]) => (
            <button key={value} type="button" onClick={() => { onAdd(value); setOpen(false); }} className="rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-primary/5">
              <p className="text-xs font-bold">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableBlock({
  block,
  index,
  onChange,
  onDuplicate,
  onRemove,
}: {
  block: BuilderBlock;
  index: number;
  onChange: (patch: Partial<BuilderBlock>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  const formatDescription = WORKOUT_FORMATS.find(([value]) => value === block.formato)?.[1];

  return (
    <article ref={setNodeRef} style={style} className="rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-2 p-3 border-b border-border/70">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground" aria-label="Arrastar bloco">
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="h-7 w-7 rounded-md bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">{String(index + 1).padStart(2, "0")}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold tracking-wide">{block.tipo}</p>
          <p className="text-[11px] text-muted-foreground truncate">{block.nome || "Sem nome"}</p>
        </div>
        <button type="button" onClick={onDuplicate} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Duplicar"><Copy className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onRemove} className="h-8 w-8 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => onChange({ expanded: !block.expanded })} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Recolher">
          {block.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </header>

      {block.expanded && (
        <div className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tipo do bloco">
              <select value={block.tipo} onChange={(e) => {
                const tipo = e.target.value as HybridBlockType;
                const suggested = suggestResultType(block.formato, tipo);
                onChange({ tipo, tipo_resultado: suggested, criterio_ranking: suggestRankingCriterion(suggested) });
              }} className="input-base">
                {HYBRID_BLOCK_TYPES.map(([value]) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Nome do bloco">
              <input value={block.nome} onChange={(e) => onChange({ nome: e.target.value })} placeholder="Lower Body Strength" className="input-base" />
            </Field>
          </div>

          <div>
            <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">Formato do treino</span>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {WORKOUT_FORMATS.map(([value]) => (
                <button key={value} type="button" onClick={() => {
                  const resultType = suggestResultType(value, block.tipo);
                  onChange({ formato: value, tipo_resultado: resultType, criterio_ranking: suggestRankingCriterion(resultType) });
                }} className={`shrink-0 px-3 py-1.5 rounded-full border text-xs font-bold transition ${block.formato === value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>
                  {value}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{formatDescription}</p>
          </div>

          <Field label="Prescrição">
            <textarea value={block.prescricao} onChange={(e) => onChange({ prescricao: e.target.value })} rows={7} placeholder={"Exemplo:\n\n4 Rounds\n1 km Run\n500 m SkiErg\n20 Wall Balls\n50 m Farmers Carry\n\nRest 2 min entre rounds"} className="input-base resize-y font-mono leading-relaxed" />
          </Field>

          <Field label="Orientações do treinador">
            <textarea value={block.orientacoes} onChange={(e) => onChange({ orientacoes: e.target.value })} rows={2} placeholder="Ex: Corrida controlada em Z3. Manter transições rápidas." className="input-base resize-y" />
          </Field>

          <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-3">
            <Toggle checked={block.resultado_habilitado} onChange={(checked) => onChange({ resultado_habilitado: checked, ranking_habilitado: checked ? block.ranking_habilitado : false })} label="Registrar resultado no app" />
            {block.resultado_habilitado && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Tipo de resultado">
                    <select value={block.tipo_resultado} onChange={(e) => {
                      const tipo = e.target.value as ResultType;
                      onChange({ tipo_resultado: tipo, criterio_ranking: suggestRankingCriterion(tipo) });
                    }} className="input-base">{RESULT_TYPES.map((r) => <option key={r}>{r}</option>)}</select>
                  </Field>
                  <Field label="Unidade">
                    <input value={block.unidade_resultado} onChange={(e) => onChange({ unidade_resultado: e.target.value })} placeholder="min, kg, reps, m..." className="input-base" />
                  </Field>
                </div>
                <Toggle checked={block.ranking_habilitado} onChange={(checked) => onChange({ ranking_habilitado: checked })} label="Criar ranking deste bloco" icon={<Trophy className="h-4 w-4" />} />
                {block.ranking_habilitado && (
                  <div className="space-y-3">
                    <Field label="Critério de classificação">
                      <select value={block.criterio_ranking} onChange={(e) => onChange({ criterio_ranking: e.target.value as "menor" | "maior" })} className="input-base">
                        <option value="menor">Menor resultado vence</option>
                        <option value="maior">Maior resultado vence</option>
                      </select>
                    </Field>
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground mb-2">Visibilidade do ranking</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          ["geral", "Geral"], ["unidade", "Por unidade"], ["turma", "Por turma"], ["categoria", "Por categoria"],
                          ["masculino", "Masculino"], ["feminino", "Feminino"], ["faixa_etaria", "Faixa etária"],
                        ].map(([key, label]) => (
                          <label key={key} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs cursor-pointer">
                            <input type="checkbox" checked={block.visibilidade_ranking[key as keyof Visibility]} onChange={(e) => onChange({ visibilidade_ranking: { ...block.visibilidade_ranking, [key]: e.target.checked } })} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function Toggle({ checked, onChange, label, description, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; icon?: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4" />
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{label}</span>
        {description ? <span className="block text-[11px] text-muted-foreground mt-0.5">{description}</span> : null}
      </span>
    </label>
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
