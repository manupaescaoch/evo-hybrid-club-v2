import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Dumbbell, Pencil, Trash2, Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BibliotecaListLayout } from "@/components/biblioteca/BibliotecaListLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TIPOS_SESSAO, tipoSessaoMeta, type SessaoTipo } from "@/lib/corrida-tipos";

export const Route = createFileRoute("/_app/biblioteca/treinos")({
  head: () => ({ meta: [{ title: "Treinos — Biblioteca" }] }),
  component: BibliotecaTreinosPage,
});

type Modelo = {
  id: string;
  nome: string;
  tipo: SessaoTipo;
  descricao: string | null;
  objetivo: string | null;
  duracao_min: number | null;
  distancia_km: number | null;
  pace_alvo: string | null;
  zona_fc: string | null;
  tags: string[];
};

const EMPTY: Omit<Modelo, "id"> = {
  nome: "",
  tipo: "longao",
  descricao: "",
  objetivo: "",
  duracao_min: null,
  distancia_km: null,
  pace_alvo: "",
  zona_fc: "",
  tags: [],
};

function BibliotecaTreinosPage() {
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<Modelo[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [editando, setEditando] = useState<Modelo | null>(null);
  const [open, setOpen] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("corrida_modelos_sessao")
      .select("id, nome, tipo, descricao, objetivo, duracao_min, distancia_km, pace_alvo, zona_fc, tags")
      .order("tipo", { ascending: true })
      .order("nome", { ascending: true });
    if (error) toast.error("Erro ao carregar treinos");
    else setItens((data ?? []) as Modelo[]);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(
    () =>
      itens.filter((m) => {
        if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
        if (busca && !m.nome.toLowerCase().includes(busca.toLowerCase())) return false;
        return true;
      }),
    [itens, busca, filtroTipo],
  );

  const abrirNovo = () => {
    setEditando({ id: "", ...EMPTY });
    setOpen(true);
  };
  const abrirEditar = (m: Modelo) => {
    setEditando(m);
    setOpen(true);
  };

  const remover = async (m: Modelo) => {
    if (!confirm(`Remover "${m.nome}"?`)) return;
    const { error } = await supabase.from("corrida_modelos_sessao").delete().eq("id", m.id);
    if (error) toast.error("Erro ao remover");
    else {
      toast.success("Treino removido");
      setItens((p) => p.filter((x) => x.id !== m.id));
    }
  };

  const salvar = async (m: Modelo): Promise<void> => {
    if (!m.nome.trim()) {
      toast.error("Informe o nome do treino");
      return;
    }
    const payload = {
      nome: m.nome.trim(),
      tipo: m.tipo,
      descricao: m.descricao || null,
      objetivo: m.objetivo || null,
      duracao_min: m.duracao_min,
      distancia_km: m.distancia_km,
      pace_alvo: m.pace_alvo || null,
      zona_fc: m.zona_fc || null,
      tags: m.tags ?? [],
    };
    if (m.id) {
      const { error } = await supabase.from("corrida_modelos_sessao").update(payload).eq("id", m.id);
      if (error) {
        toast.error("Erro ao salvar");
        return;
      }
      toast.success("Treino atualizado");
    } else {
      const { error } = await supabase.from("corrida_modelos_sessao").insert({ ...payload, blocos: [] });
      if (error) {
        toast.error("Erro ao criar");
        return;
      }
      toast.success("Treino criado");
    }
    setOpen(false);
    setEditando(null);
    carregar();
  };

  return (
    <>
      <BibliotecaListLayout
        title="Treinos"
        description="Modelos de sessões de treino salvos para reutilizar nos planos dos alunos."
        icon={Dumbbell}
        onCreate={abrirNovo}
        createLabel="Novo treino"
        searchPlaceholder="Buscar treino por nome…"
        query={busca}
        onQueryChange={setBusca}
        titleBadge={
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {itens.length}
          </span>
        }
        filters={
          <div className="flex flex-wrap gap-1.5">
            <Chip ativo={filtroTipo === "todos"} onClick={() => setFiltroTipo("todos")}>
              Todos
            </Chip>
            {TIPOS_SESSAO.map((t) => (
              <Chip key={t.value} ativo={filtroTipo === t.value} onClick={() => setFiltroTipo(t.value)}>
                {t.label}
              </Chip>
            ))}
          </div>
        }
        isEmpty={!loading && filtrados.length === 0 && itens.length === 0}
        emptyHint="Você ainda não possui treinos salvos. Crie modelos reutilizáveis para acelerar o planejamento."
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Nenhum treino encontrado.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((m) => {
              const meta = tipoSessaoMeta(m.tipo);
              const Icon = meta.Icon;
              return (
                <article
                  key={m.id}
                  className="group rounded-2xl border border-border bg-card p-4 hover:border-blue-200 hover:shadow-sm transition flex flex-col"
                >
                  <header className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${meta.cor}1A`, color: meta.cor }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold leading-tight truncate">{m.nome}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {meta.label}
                        {m.duracao_min ? ` · ${m.duracao_min} min` : ""}
                        {m.distancia_km ? ` · ${m.distancia_km} km` : ""}
                      </p>
                    </div>
                  </header>
                  {m.descricao && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{m.descricao}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.pace_alvo && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Pace {m.pace_alvo}
                      </span>
                    )}
                    {m.zona_fc && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {m.zona_fc}
                      </span>
                    )}
                    {m.tags.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-1 justify-end">
                    <button
                      onClick={() => abrirEditar(m)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => remover(m)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </BibliotecaListLayout>

      <EditorModal open={open} onOpenChange={setOpen} modelo={editando} onSave={salvar} />
    </>
  );
}

function Chip({ children, ativo, onClick }: { children: React.ReactNode; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${
        ativo
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-card border-border text-muted-foreground hover:border-blue-200"
      }`}
    >
      {children}
    </button>
  );
}

function EditorModal({
  open,
  onOpenChange,
  modelo,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modelo: Modelo | null;
  onSave: (m: Modelo) => void | Promise<void>;
}) {
  const [m, setM] = useState<Modelo | null>(modelo);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setM(modelo);
    setTagInput("");
  }, [modelo]);

  if (!m) return null;

  const set = <K extends keyof Modelo>(k: K, v: Modelo[K]) => setM((p) => (p ? { ...p, [k]: v } : p));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (m.tags.includes(t)) return;
    set("tags", [...m.tags, t]);
    setTagInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m.id ? "Editar treino" : "Novo treino"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Nome">
            <input
              autoFocus
              value={m.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex.: Longão progressivo 90'"
              className="w-full rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select
                value={m.tipo}
                onChange={(e) => set("tipo", e.target.value as SessaoTipo)}
                className="w-full rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
              >
                {TIPOS_SESSAO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Objetivo">
              <input
                value={m.objetivo ?? ""}
                onChange={(e) => set("objetivo", e.target.value)}
                placeholder="Ex.: resistência aeróbica"
                className="w-full rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duração (min)">
              <input
                type="number"
                value={m.duracao_min ?? ""}
                onChange={(e) => set("duracao_min", e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
              />
            </Field>
            <Field label="Distância (km)">
              <input
                type="number"
                step="0.1"
                value={m.distancia_km ?? ""}
                onChange={(e) => set("distancia_km", e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pace alvo">
              <input
                value={m.pace_alvo ?? ""}
                onChange={(e) => set("pace_alvo", e.target.value)}
                placeholder="5:30/km"
                className="w-full rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
              />
            </Field>
            <Field label="Zona FC">
              <select
                value={m.zona_fc ?? ""}
                onChange={(e) => set("zona_fc", e.target.value)}
                className="w-full rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
              >
                <option value="">—</option>
                <option value="Z1">Z1 — Recuperação</option>
                <option value="Z2">Z2 — Aeróbico base</option>
                <option value="Z3">Z3 — Aeróbico forte</option>
                <option value="Z4">Z4 — Limiar</option>
                <option value="Z5">Z5 — VO2max</option>
              </select>
            </Field>
          </div>

          <Field label="Descrição">
            <textarea
              value={m.descricao ?? ""}
              onChange={(e) => set("descricao", e.target.value)}
              rows={4}
              placeholder="Estrutura, intenção, observações…"
              className="w-full rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition resize-none"
            />
          </Field>

          <Field label="Tags">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {m.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => set("tags", m.tags.filter((x) => x !== t))}
                    className="hover:text-blue-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Adicionar tag e Enter"
                className="flex-1 rounded-lg border border-input bg-muted/30 focus:bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 rounded-lg bg-muted hover:bg-muted/70 text-sm font-medium transition inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(m)}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-sm transition"
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold tracking-wide uppercase text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
