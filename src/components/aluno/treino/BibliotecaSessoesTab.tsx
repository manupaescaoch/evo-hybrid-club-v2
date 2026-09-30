import { useEffect, useState } from "react";
import { Loader2, BookOpen, Search, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tipoSessaoMeta, type SessaoTipo } from "@/lib/corrida-tipos";
import { toast } from "sonner";

export type ModeloSessao = {
  id: string;
  nome: string;
  tipo: SessaoTipo;
  descricao: string | null;
  objetivo: string | null;
  duracao_min: number | null;
  distancia_km: number | null;
  pace_alvo: string | null;
  zona_fc: string | null;
  blocos: Array<Record<string, unknown>>;
  tags: string[];
};

export function BibliotecaSessoesTab({
  onAplicar,
}: {
  onAplicar?: (modelo: ModeloSessao) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [modelos, setModelos] = useState<ModeloSessao[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("corrida_modelos_sessao")
        .select("*")
        .order("tipo", { ascending: true })
        .order("nome", { ascending: true });
      if (cancel) return;
      if (error) {
        toast.error("Erro ao carregar biblioteca");
      } else if (data) {
        setModelos(
          data.map((m) => ({
            ...m,
            blocos: Array.isArray(m.blocos) ? (m.blocos as Array<Record<string, unknown>>) : [],
            tags: m.tags ?? [],
          })) as ModeloSessao[],
        );
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const filtrados = modelos.filter((m) => {
    if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
    if (busca && !m.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando biblioteca...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Biblioteca de sessões</h3>
          <span className="text-xs text-muted-foreground ml-auto">{modelos.length} modelos</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-lg bg-muted/40 border border-input px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
          >
            <option value="todos">Todos os tipos</option>
            <option value="longao">Longão</option>
            <option value="regenerativo">Regenerativo</option>
            <option value="intervalado">Intervalado</option>
            <option value="tempo">Tempo run</option>
            <option value="fartlek">Fartlek</option>
            <option value="strides">Strides</option>
            <option value="forca">Força</option>
          </select>
        </div>
      </section>

      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nenhum modelo encontrado.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtrados.map((m) => {
            const meta = tipoSessaoMeta(m.tipo);
            const Icon = meta.Icon;
            return (
              <article key={m.id} className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition">
                <header className="flex items-start gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${meta.cor}1A`, color: meta.cor }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold leading-tight">{m.nome}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {meta.label}
                      {m.duracao_min ? ` · ${m.duracao_min} min` : ""}
                      {m.distancia_km ? ` · ${m.distancia_km} km` : ""}
                      {m.zona_fc ? ` · ${m.zona_fc}` : ""}
                    </p>
                  </div>
                </header>
                {m.descricao && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{m.descricao}</p>}
                {m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.tags.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {onAplicar && (
                  <button
                    type="button"
                    onClick={() => onAplicar(m)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 text-xs font-semibold transition"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Aplicar este modelo
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
