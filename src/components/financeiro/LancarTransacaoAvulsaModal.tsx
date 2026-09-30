import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Categoria { id: string; nome: string; tipo: "receita" | "despesa"; cor: string }

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function LancarTransacaoAvulsaModal({ onClose, onSaved }: Props) {
  const { crmUser } = useAuth();
  const [cats, setCats] = useState<Categoria[]>([]);
  const hoje = new Date().toISOString().slice(0, 10);
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.from("financeiro_categorias").select("*").order("nome")
      .then(({ data }) => setCats((data ?? []) as Categoria[]));
  }, []);

  async function salvar() {
    const num = Number(valor.replace(",", "."));
    if (!num || isNaN(num)) { toast.error("Valor inválido"); return; }
    const valorFinal = tipo === "despesa" ? -Math.abs(num) : Math.abs(num);
    setSaving(true);
    const { error } = await supabase.from("transacoes").insert({
      tipo,
      origem: "manual",
      valor: valorFinal,
      data_transacao: data,
      competencia: `${data.slice(0, 7)}-01`,
      descricao: descricao || null,
      categoria_id: categoriaId || null,
      criado_por: crmUser?.nome ?? crmUser?.email ?? "sistema",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transação lançada");
    onSaved();
    onClose();
  }

  const catsFiltradas = cats.filter((c) => c.tipo === tipo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 px-safe" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 text-[#111]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Lançar transação</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setTipo("receita"); setCategoriaId(""); }}
            className="h-10 rounded-lg text-sm font-semibold border-2 transition-colors"
            style={tipo === "receita"
              ? { background: "var(--green)", color: "#fff", borderColor: "var(--green)" }
              : { borderColor: "#e5e7eb", color: "#374151" }}>
            Receita
          </button>
          <button onClick={() => { setTipo("despesa"); setCategoriaId(""); }}
            className="h-10 rounded-lg text-sm font-semibold border-2 transition-colors"
            style={tipo === "despesa"
              ? { background: "var(--red)", color: "#fff", borderColor: "var(--red)" }
              : { borderColor: "#e5e7eb", color: "#374151" }}>
            Despesa
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Valor (R$)</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder="0,00" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Categoria</label>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm">
            <option value="">— sem categoria —</option>
            {catsFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Opcional" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving}
            className="flex-1 h-10 rounded-lg bg-black text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
