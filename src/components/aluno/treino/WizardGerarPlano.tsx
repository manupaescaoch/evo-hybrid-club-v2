import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight, Sparkles, Zap, AlertTriangle } from "lucide-react";
import {
  type PerfilCorrida,
  type Zona,
  ZONAS,
  paceToKmh,
  toISODate,
  addDays,
} from "@/lib/corrida-zonas";
import {
  type EscopoGeracao,
  type ModeloPeriodizacao,
  type ParamsGeracao,
  type DistribuicaoDia,
  type SemanaGerada,
  DISTRIBUICAO_DEFAULT,
  ZONA_DEFAULT_POR_TIPO,
  curvaVolume,
  gerarPlano,
} from "@/lib/corrida-gerador";
import { TIPOS_SESSAO, DIAS_SEMANA, type SessaoTipo } from "@/lib/corrida-tipos";

const ESCOPOS: { value: EscopoGeracao; label: string; desc: string; semanas: number }[] = [
  { value: "semana", label: "Só esta semana", desc: "1 microciclo", semanas: 1 },
  { value: "mesociclo", label: "Bloco de 4 semanas", desc: "3 fortes + 1 regenerativa", semanas: 4 },
  { value: "macrociclo", label: "Macro até a prova", desc: "12–24 semanas", semanas: 16 },
];

const MODELOS: { value: ModeloPeriodizacao; label: string; desc: string }[] = [
  { value: "linear", label: "Linear", desc: "Volume sobe progressivo até o pico" },
  { value: "polarizado", label: "Polarizado 80/20", desc: "80% Z1–Z2, 20% Z4–Z5" },
  { value: "piramidal", label: "Piramidal", desc: "Sobe, atinge pico no meio, desce" },
  { value: "reverso", label: "Reverso", desc: "Volume alto no início, foco em intensidade depois" },
];

export function WizardGerarPlano({
  aberto,
  onClose,
  semanaInicio,
  perfil,
  onGerar,
}: {
  aberto: boolean;
  onClose: () => void;
  semanaInicio: string;
  perfil: PerfilCorrida;
  onGerar: (params: ParamsGeracao, semanas: SemanaGerada[]) => Promise<void>;
}) {
  const [passo, setPasso] = useState(1);
  const [salvando, setSalvando] = useState(false);

  const [escopo, setEscopo] = useState<EscopoGeracao>("semana");
  const [semanasTotal, setSemanasTotal] = useState(1);
  const [provaNome, setProvaNome] = useState("");
  const [provaData, setProvaData] = useState("");
  const [provaDistancia, setProvaDistancia] = useState<number | "">("");

  const [distribuicao, setDistribuicao] = useState<DistribuicaoDia[]>(DISTRIBUICAO_DEFAULT);
  const [diaLongao, setDiaLongao] = useState<number | null>(7);

  const [modelo, setModelo] = useState<ModeloPeriodizacao>("linear");
  const [volumeBase, setVolumeBase] = useState<number>(30);
  const [volumePico, setVolumePico] = useState<number>(45);

  function escolherEscopo(e: EscopoGeracao) {
    setEscopo(e);
    if (e === "semana") setSemanasTotal(1);
    else if (e === "mesociclo") setSemanasTotal(4);
    else setSemanasTotal(16);
  }

  function toggleDia(dow: number) {
    setDistribuicao((prev) =>
      prev.map((d) => (d.dow === dow ? { ...d, ativo: !d.ativo } : d)),
    );
  }

  function setTipoDia(dow: number, tipo: SessaoTipo) {
    setDistribuicao((prev) =>
      prev.map((d) => (d.dow === dow ? { ...d, tipo, zona: ZONA_DEFAULT_POR_TIPO[tipo] } : d)),
    );
  }

  function setZonaDia(dow: number, zona: Zona) {
    setDistribuicao((prev) => prev.map((d) => (d.dow === dow ? { ...d, zona } : d)));
  }

  const params: ParamsGeracao = useMemo(
    () => ({
      escopo,
      semanaInicio,
      semanasTotal,
      volumeBaseKm: Number(volumeBase) || 0,
      volumePicoKm: Number(volumePico) || 0,
      modelo,
      distribuicao,
      diaLongao,
      provaNome: provaNome || undefined,
      provaData: provaData || undefined,
      provaDistanciaKm: typeof provaDistancia === "number" ? provaDistancia : undefined,
    }),
    [escopo, semanaInicio, semanasTotal, volumeBase, volumePico, modelo, distribuicao, diaLongao, provaNome, provaData, provaDistancia],
  );

  const preview = useMemo(() => {
    if (passo < 4) return [] as SemanaGerada[];
    try {
      return gerarPlano(perfil, params);
    } catch {
      return [];
    }
  }, [passo, perfil, params]);

  const curva = useMemo(
    () => curvaVolume(Number(volumeBase) || 0, Number(volumePico) || 0, semanasTotal, modelo),
    [volumeBase, volumePico, semanasTotal, modelo],
  );

  // Validações leves
  const alertas: string[] = useMemo(() => {
    const out: string[] = [];
    const ativos = distribuicao.filter((d) => d.ativo);
    if (ativos.length === 0) out.push("Selecione ao menos 1 dia de treino");
    // 3+ Z3+ seguidos
    let seguidos = 0;
    for (const d of distribuicao) {
      if (d.ativo && ["Z3", "Z4", "Z5"].includes(d.zona)) {
        seguidos++;
        if (seguidos >= 3) {
          out.push("3+ dias de alta intensidade seguidos — considere intercalar");
          break;
        }
      } else seguidos = 0;
    }
    if (Number(volumePico) < Number(volumeBase)) out.push("Volume pico menor que volume base");
    return out;
  }, [distribuicao, volumeBase, volumePico]);

  async function confirmar() {
    setSalvando(true);
    try {
      await onGerar(params, preview);
      onClose();
      setPasso(1);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Gerar plano de treino
          </SheetTitle>
        </SheetHeader>

        {/* Stepper */}
        <ol className="flex items-center gap-1 mb-6 text-[11px] font-semibold uppercase tracking-wider">
          {["Escopo", "Dias", "Periodização", "Revisar"].map((p, i) => {
            const n = i + 1;
            const ativo = passo === n;
            const feito = passo > n;
            return (
              <li key={p} className="flex-1 flex items-center gap-1">
                <span
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] ${
                    feito
                      ? "bg-primary text-primary-foreground"
                      : ativo
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {feito ? <Check className="h-3 w-3" /> : n}
                </span>
                <span className={ativo ? "text-foreground" : "text-muted-foreground"}>{p}</span>
                {n < 4 && <span className="flex-1 h-px bg-border ml-1" />}
              </li>
            );
          })}
        </ol>

        {/* Passo 1 — Escopo */}
        {passo === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">O que você quer gerar?</p>
            {ESCOPOS.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => escolherEscopo(e.value)}
                className={`w-full text-left rounded-xl border p-4 transition ${
                  escopo === e.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <p className="font-bold text-sm">{e.label}</p>
                <p className="text-xs text-muted-foreground">{e.desc}</p>
              </button>
            ))}
            {escopo !== "semana" && (
              <div className="mt-4 rounded-xl border border-border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configuração</p>
                <div>
                  <label className="text-xs text-muted-foreground">Número de semanas</label>
                  <input
                    type="number"
                    min={2}
                    max={32}
                    value={semanasTotal}
                    onChange={(e) => setSemanasTotal(Math.max(1, Number(e.target.value)))}
                    className="mt-1 w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
                  />
                </div>
                {escopo === "macrociclo" && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Nome da prova (opcional)</label>
                      <input
                        value={provaNome}
                        onChange={(e) => setProvaNome(e.target.value)}
                        placeholder="Ex: Meia POA"
                        className="mt-1 w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Data</label>
                        <input
                          type="date"
                          value={provaData}
                          onChange={(e) => setProvaData(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Distância (km)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={provaDistancia}
                          onChange={(e) => setProvaDistancia(e.target.value ? Number(e.target.value) : "")}
                          placeholder="21.1"
                          className="mt-1 w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Passo 2 — Dias */}
        {passo === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Quais dias o aluno treina?</p>
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS_SEMANA.map((nome, i) => {
                const dow = i + 1;
                const d = distribuicao.find((x) => x.dow === dow)!;
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleDia(dow)}
                    className={`rounded-lg py-2 text-[10px] font-extrabold tracking-wider transition ${
                      d.ativo ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {nome}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dia do longão</label>
              <select
                value={diaLongao ?? ""}
                onChange={(e) => setDiaLongao(e.target.value ? Number(e.target.value) : null)}
                className="mt-1 w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
              >
                <option value="">Sem longão</option>
                {distribuicao
                  .filter((d) => d.ativo)
                  .map((d) => (
                    <option key={d.dow} value={d.dow}>
                      {DIAS_SEMANA[d.dow - 1]}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-4 rounded-xl border border-border p-3 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">
                {distribuicao.filter((d) => d.ativo).length} dias/sem
              </span>{" "}
              · Longão {diaLongao ? DIAS_SEMANA[diaLongao - 1] : "—"} · Off{" "}
              {distribuicao.filter((d) => !d.ativo).map((d) => DIAS_SEMANA[d.dow - 1]).join("+") || "nenhum"}
            </div>
          </div>
        )}

        {/* Passo 3 — Periodização e intensidade por dia */}
        {passo === 3 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Modelo de periodização</p>
              <div className="grid grid-cols-2 gap-2">
                {MODELOS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setModelo(m.value)}
                    className={`text-left rounded-lg border p-3 transition ${
                      modelo === m.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <p className="text-sm font-bold">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Volume {escopo === "semana" ? "alvo" : "base"} (km)
                </label>
                <input
                  type="number"
                  value={volumeBase}
                  onChange={(e) => setVolumeBase(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
                />
              </div>
              {escopo !== "semana" && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Volume pico (km)</label>
                  <input
                    type="number"
                    value={volumePico}
                    onChange={(e) => setVolumePico(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Distribuição por dia</p>
              <div className="space-y-1.5">
                {distribuicao
                  .filter((d) => d.ativo)
                  .map((d) => {
                    const paceRange = perfil.pace_limiar_seg ? null : null;
                    return (
                      <div key={d.dow} className="grid grid-cols-[40px_1fr_90px] gap-2 items-center">
                        <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground">
                          {DIAS_SEMANA[d.dow - 1]}
                        </span>
                        <select
                          value={d.tipo}
                          onChange={(e) => setTipoDia(d.dow, e.target.value as SessaoTipo)}
                          className="rounded-md bg-muted/40 border border-input px-2 py-1.5 text-xs"
                        >
                          {TIPOS_SESSAO.filter((t) => t.value !== "descanso").map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={d.zona}
                          onChange={(e) => setZonaDia(d.dow, e.target.value as Zona)}
                          className="rounded-md bg-muted/40 border border-input px-2 py-1.5 text-xs"
                        >
                          {ZONAS.map((z) => (
                            <option key={z.z} value={z.z}>
                              {z.z}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
              </div>
            </div>

            {alertas.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                {alertas.map((a) => (
                  <p key={a} className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" /> {a}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Passo 4 — Revisão */}
        {passo === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {preview.length} semana{preview.length > 1 ? "s" : ""} ·{" "}
              {preview.reduce((acc, s) => acc + s.sessoes.length, 0)} sessões
            </p>

            {escopo !== "semana" && curva.length > 1 && (
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Curva de volume (km/sem)
                </p>
                <div className="flex items-end gap-1 h-20">
                  {curva.map((v, i) => {
                    const max = Math.max(...curva);
                    const h = max > 0 ? (v / max) * 100 : 0;
                    const regen = (i + 1) % 4 === 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                        <span className="text-[9px] text-muted-foreground">{v.toFixed(0)}</span>
                        <div
                          className={`w-full rounded-t ${regen ? "bg-emerald-400" : "bg-primary"}`}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2 font-bold">Sem</th>
                    {DIAS_SEMANA.map((d) => (
                      <th key={d} className="p-1 font-bold">
                        {d}
                      </th>
                    ))}
                    <th className="p-2 font-bold text-right">Km</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((s, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 font-bold">{i + 1}</td>
                      {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
                        const dataDia = toISODate(addDays(new Date(s.data_inicio + "T00:00"), dow - 1));
                        const sess = s.sessoes.find((x) => x.data === dataDia);
                        return (
                          <td key={dow} className="p-1 text-center">
                            {sess ? (
                              <span className="inline-block px-1 py-0.5 rounded bg-muted text-[10px]">
                                {sess.distancia_km ? `${sess.distancia_km}k` : sess.tipo.slice(0, 3)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">·</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-right font-bold">{s.volume_alvo_km}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {perfil.pace_limiar_seg && (
              <p className="text-[11px] text-muted-foreground">
                Pace de referência: {Math.floor(perfil.pace_limiar_seg / 60)}:
                {String(perfil.pace_limiar_seg % 60).padStart(2, "0")}/km ·{" "}
                {paceToKmh(`${Math.floor(perfil.pace_limiar_seg / 60)}:${String(perfil.pace_limiar_seg % 60).padStart(2, "0")}`)?.toFixed(1).replace(".", ",")} km/h na esteira
              </p>
            )}
          </div>
        )}

        {/* Footer com navegação */}
        <div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 py-3 mt-6 bg-background border-t border-border flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (passo === 1 ? onClose() : setPasso((p) => p - 1))}
            disabled={salvando}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> {passo === 1 ? "Cancelar" : "Voltar"}
          </Button>
          {passo < 4 ? (
            <Button
              size="sm"
              onClick={() => setPasso((p) => p + 1)}
              disabled={passo === 2 && distribuicao.filter((d) => d.ativo).length === 0}
            >
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={confirmar} disabled={salvando}>
              <Zap className="h-4 w-4 mr-1" /> {salvando ? "Gerando..." : "Gerar e abrir"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
