import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSemanaTreinoAluno, type AlunoTreinoSessao, type AlunoTreinoBloco } from "@/backend/aluno-treino.functions";
import { paceToKmh } from "@/lib/corrida-zonas";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Flame,
  Footprints,
  Download,
  Check,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/aluno/treino")({
  head: () => ({
    meta: [
      { title: "WOD de hoje — App do Aluno | EVO HYBRID CLUB" },
      {
        name: "description",
        content:
          "Detalhes do WOD de hoje: aquecimento, rodagem, intensidade por zona e blocos de execução.",
      },
    ],
  }),
  component: AlunoTreinoPage,
});

const BLUE = "#0033FF";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function segundaDe(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = m.getDay();
  m.setDate(m.getDate() + (dow === 0 ? -6 : 1 - dow));
  return m;
}
function descBloco(b: AlunoTreinoBloco) {
  const partes: string[] = [];
  if (b.series) { const se = b.series.replace(/x$/i, ""); partes.push(b.distancia_serie ? `${se}x ${b.distancia_serie}` : /^\d+$/.test(se) ? `${se}x` : b.series); }
  else if (b.distancia_serie) partes.push(b.distancia_serie);
  if (b.duracao_min) partes.push(/[a-z]/i.test(b.duracao_min) ? b.duracao_min : `${b.duracao_min} min`);
  if (b.pace) {
    const kmh = paceToKmh(b.pace);
    partes.push(kmh ? `${b.pace} /km (${kmh} km/h)` : b.pace);
  }
  if (b.zona) partes.push(b.zona);
  if (b.recuperacao) partes.push(`rec. ${b.recuperacao}`);
  return [partes.join(" · "), b.descricao].filter(Boolean).join(" — ");
}

function AlunoTreinoPage() {
  const hoje = new Date();
  const [semana, setSemana] = useState(() => segundaDe(hoje));
  const [diaSel, setDiaSel] = useState(() => ymd(hoje));
  const fim = new Date(semana);
  fim.setDate(semana.getDate() + 6);

  const fetchSemana = useServerFn(getSemanaTreinoAluno);
  const [sessoes, setSessoes] = useState<AlunoTreinoSessao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const inicioStr = ymd(semana);
  const fimStr = ymd(fim);
  useEffect(() => {
    let vivo = true;
    setIsLoading(true);
    fetchSemana({ data: { inicio: inicioStr, fim: fimStr } })
      .then((r) => vivo && setSessoes(Array.isArray(r?.sessoes) ? r.sessoes : []))
      .catch(() => vivo && setSessoes([]))
      .finally(() => vivo && setIsLoading(false));
    return () => {
      vivo = false;
    };
  }, [inicioStr, fimStr, fetchSemana]);
  const diasComTreino = useMemo(
    () => new Set(sessoes.filter((s) => s.tipo !== "descanso").map((s) => s.data)),
    [sessoes],
  );
  const doDia = sessoes.filter((s) => s.data === diaSel);
  const isHoje = diaSel === ymd(hoje);
  const [y, mo, d] = diaSel.split("-").map(Number);
  const dataLabel = new Date(y, mo - 1, d)
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })
    .replace(".", "")
    .toUpperCase();

  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setFeitos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const mudarSemana = (delta: number) => {
    const n = new Date(semana);
    n.setDate(semana.getDate() + delta * 7);
    setSemana(n);
    const atual = segundaDe(hoje);
    setDiaSel(ymd(n.getTime() === atual.getTime() ? hoje : n));
  };

  // Finalizar treino modal
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [tempoMin, setTempoMin] = useState("50");
  const [tempoSec, setTempoSec] = useState("00");
  const [distancia, setDistancia] = useState("10");
  const [obs, setObs] = useState("");
  const [pse, setPse] = useState<number | null>(null);
  const [, setSalvo] = useState(false);

  const pseEscala = [
    { v: 1, emoji: "😌", label: "Muito leve" },
    { v: 2, emoji: "🙂", label: "Leve" },
    { v: 3, emoji: "😀", label: "Confortável" },
    { v: 4, emoji: "😅", label: "Moderado" },
    { v: 5, emoji: "😬", label: "Um pouco difícil" },
    { v: 6, emoji: "😮‍💨", label: "Difícil" },
    { v: 7, emoji: "😣", label: "Muito difícil" },
    { v: 8, emoji: "🥵", label: "Bem pesado" },
    { v: 9, emoji: "😵", label: "Extremo" },
    { v: 10, emoji: "🥶", label: "Máximo" },
  ];

  const abrirFinalizar = () => {
    setStep(1);
    setModalOpen(true);
  };

  const salvarTempo = () => {
    setSalvo(true);
    setStep(2);
  };

  const salvarPse = () => {
    toast.success("WOD registrado com sucesso!");
    setModalOpen(false);
    setSalvo(false);
    setPse(null);
  };


  return (
    <div className="px-4 pt-2 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <Link
          to="/aluno"
          aria-label="Voltar"
          className="h-9 w-9 -ml-1 rounded-full flex items-center justify-center hover:bg-black/5 active:scale-95 transition"
        >
          <ArrowLeft className="h-5 w-5 text-black" />
        </Link>
        <p className="text-[10px] font-extrabold tracking-[0.18em] text-black/50">{dataLabel}</p>
        <div className="w-9" />
      </div>

      <SemanaSelector
        segunda={semana}
        diaSel={diaSel}
        onSelect={setDiaSel}
        onMudar={mudarSemana}
        comTreino={diasComTreino}
      />

      <div className="flex items-center justify-between px-1">
        <h1 className="text-[11px] font-extrabold tracking-[0.2em] text-black">
          {isHoje ? "WOD DE HOJE" : "WOD DO DIA"}
        </h1>
        <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0033FF] active:scale-95 transition">
          <Download className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-white p-6 text-center text-[12px] text-black/50 ring-1 ring-black/5">Carregando WOD...</div>
      ) : doDia.length === 0 || doDia.every((s) => s.tipo === "descanso") ? (
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-black/5">
          <p className="text-[15px] font-extrabold text-black">Dia de descanso</p>
          <p className="text-[12px] text-black/55 mt-1">Nenhum WOD programado para este dia.</p>
        </div>
      ) : (
        doDia.filter((s) => s.tipo !== "descanso").map((s) => (
          <SessaoCard key={s.id} s={s} feitos={feitos} toggle={toggle} />
        ))
      )}

      {isHoje && doDia.some((s) => s.tipo !== "descanso") && (
      <button
        type="button"
        onClick={abrirFinalizar}
        className="w-full mt-1 rounded-2xl py-3.5 text-[14px] font-extrabold ring-1 transition active:scale-[0.99] inline-flex items-center justify-center gap-2 bg-[#0033FF] text-white ring-[#0033FF] hover:bg-[#0033FF]/90"
      >
        <Play className="h-4 w-4" fill="currentColor" />
        Finalizar WOD
      </button>
      )}

      {/* Modal finalizar */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-extrabold tracking-[0.18em] text-black/50">
                  {step === 1 ? "ETAPA 1 DE 2" : "ETAPA 2 DE 2"}
                </p>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/5"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4 text-black/60" />
                </button>
              </div>

              {step === 1 && (
                <div>
                  <h3 className="text-[20px] font-extrabold text-black leading-tight">
                    Como foi o WOD?
                  </h3>
                  <p className="text-[12px] text-black/55 mt-1">
                    Anote o tempo e a distância para salvar seu WOD.
                  </p>

                  {/* Tempo */}
                  <div className="mt-4">
                    <label className="text-[11px] font-extrabold tracking-[0.14em] text-black/60">
                      TEMPO
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1 rounded-2xl bg-black/[0.04] ring-1 ring-black/5 px-3 py-2.5">
                        <Clock className="h-4 w-4 text-black/40" />
                        <input
                          type="number"
                          inputMode="numeric"
                          value={tempoMin}
                          onChange={(e) => setTempoMin(e.target.value)}
                          className="w-full bg-transparent outline-none text-[16px] font-extrabold tabular-nums text-black"
                          placeholder="min"
                        />
                        <span className="text-[12px] font-bold text-black/40">min</span>
                      </div>
                      <div className="flex-1 flex items-center gap-1 rounded-2xl bg-black/[0.04] ring-1 ring-black/5 px-3 py-2.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={tempoSec}
                          onChange={(e) => setTempoSec(e.target.value)}
                          className="w-full bg-transparent outline-none text-[16px] font-extrabold tabular-nums text-black"
                          placeholder="seg"
                        />
                        <span className="text-[12px] font-bold text-black/40">seg</span>
                      </div>
                    </div>
                  </div>

                  {/* Distância */}
                  <div className="mt-3">
                    <label className="text-[11px] font-extrabold tracking-[0.14em] text-black/60">
                      DISTÂNCIA
                    </label>
                    <div className="mt-1.5 flex items-center gap-1 rounded-2xl bg-black/[0.04] ring-1 ring-black/5 px-3 py-2.5">
                      <MapPin className="h-4 w-4 text-black/40" />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={distancia}
                        onChange={(e) => setDistancia(e.target.value)}
                        className="w-full bg-transparent outline-none text-[16px] font-extrabold tabular-nums text-black"
                        placeholder="km"
                      />
                      <span className="text-[12px] font-bold text-black/40">km</span>
                    </div>
                  </div>

                  {/* Observação */}
                  <div className="mt-3">
                    <label className="text-[11px] font-extrabold tracking-[0.14em] text-black/60">
                      OBSERVAÇÕES (OPCIONAL)
                    </label>
                    <textarea
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      rows={2}
                      placeholder="Como você se sentiu, clima, sensações..."
                      className="mt-1.5 w-full rounded-2xl bg-black/[0.04] ring-1 ring-black/5 px-3 py-2.5 text-[13px] text-black placeholder:text-black/30 outline-none resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={salvarTempo}
                    disabled={!tempoMin}
                    className="mt-4 w-full rounded-2xl bg-[#0033FF] text-white py-3.5 text-[14px] font-extrabold active:scale-[0.99] transition disabled:opacity-50"
                  >
                    Salvar WOD
                  </button>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h3 className="text-[20px] font-extrabold text-black leading-tight">
                    Qual sua percepção de esforço?
                  </h3>
                  <p className="text-[12px] text-black/55 mt-1">
                    Escala PSE de 1 a 10. Escolha o que mais representa.
                  </p>

                  <ul className="mt-4 space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
                    {pseEscala.map((p) => {
                      const active = pse === p.v;
                      return (
                        <li key={p.v}>
                          <button
                            type="button"
                            onClick={() => setPse(p.v)}
                            className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 transition active:scale-[0.99] ${
                              active
                                ? "bg-[#0033FF]/10 ring-[#0033FF]"
                                : "bg-white ring-black/10 hover:bg-black/[0.02]"
                            }`}
                          >
                            <span className="text-[22px]">{p.emoji}</span>
                            <span
                              className={`text-[12px] font-extrabold tabular-nums w-6 text-center rounded-md py-0.5 ${
                                active
                                  ? "bg-[#0033FF] text-white"
                                  : "bg-black/[0.06] text-black/70"
                              }`}
                            >
                              {p.v}
                            </span>
                            <span className="text-[13px] font-semibold text-black text-left flex-1">
                              {p.label}
                            </span>
                            {active && (
                              <Check className="h-4 w-4 text-[#0033FF]" strokeWidth={3} />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <button
                    type="button"
                    onClick={salvarPse}
                    disabled={pse === null}
                    className="mt-4 w-full rounded-2xl bg-[#22C55E] text-white py-3.5 text-[14px] font-extrabold active:scale-[0.99] transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                    Concluir WOD
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SessaoCard({ s, feitos, toggle }: { s: AlunoTreinoSessao; feitos: Set<string>; toggle: (id: string) => void }) {
  return (
    <div className="space-y-2">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-black/5"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0033FF]/10 px-2.5 py-1">
          <Footprints className="h-3 w-3 text-[#0033FF]" />
          <span className="text-[10px] font-extrabold tracking-[0.14em] text-[#0033FF] uppercase">{s.tipo}</span>
        </div>
        <h2 className="mt-2.5 text-[19px] font-extrabold leading-tight text-black">{s.nome}</h2>
        {s.pace_alvo && (
          <p className="mt-0.5 text-[12px] text-black/55">
            Pace alvo: {s.pace_alvo} /km{paceToKmh(s.pace_alvo) ? ` · ${paceToKmh(s.pace_alvo)} km/h` : ""}
          </p>
        )}
        {s.objetivo && <p className="mt-1 text-[12px] text-black/60">{s.objetivo}</p>}
        <div className="mt-3 flex items-center gap-4 text-[12px] text-black/70">
          {s.duracao_min != null && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-black/50" /><span className="font-semibold">{s.duracao_min} min</span></span>
          )}
          {s.distancia_km != null && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-black/50" /><span className="font-semibold">{Number(s.distancia_km)} km</span></span>
          )}
          {s.zona_fc && (
            <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-black/50" /><span className="font-semibold">{s.zona_fc}</span></span>
          )}
        </div>
        {s.observacao && <p className="mt-2 text-[11px] text-black/55">{s.observacao}</p>}
      </motion.section>
      <ul className="space-y-2">
        {(s.blocos ?? []).map((b, i) => {
          const done = feitos.has(b.id);
          return (
            <motion.li
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 * i }}
              className="rounded-2xl bg-white ring-1 ring-black/5 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.18)] flex items-center gap-3 p-3"
            >
              <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-[12px] font-extrabold tabular-nums ${done ? "bg-[#22C55E]/10 text-[#16a34a]" : "bg-black/5 text-black/60"}`}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold text-black leading-tight">{b.nome}</p>
                <p className="text-[11px] text-black/55 mt-0.5">{descBloco(b)}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(b.id)}
                aria-label={done ? "Desmarcar bloco" : "Marcar bloco concluído"}
                className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center transition active:scale-90 ${done ? "bg-[#22C55E]" : "border-2 border-black/15 bg-white"}`}
              >
                {done && <Check className="h-4 w-4 text-white" strokeWidth={3.5} />}
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function SemanaSelector({
  segunda,
  diaSel,
  onSelect,
  onMudar,
  comTreino,
}: {
  segunda: Date;
  diaSel: string;
  onSelect: (d: string) => void;
  onMudar: (delta: number) => void;
  comTreino: Set<string>;
}) {
  const hojeStr = ymd(new Date());
  const monday = segunda;
  const dias = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
  const onejan = new Date(monday.getFullYear(), 0, 1);
  const semanaNum = Math.ceil(((monday.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  const atual = segundaDe(new Date()).getTime() === monday.getTime();

  return (
    <section className="rounded-2xl bg-white p-3 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onMudar(-1)} aria-label="Semana anterior" className="h-8 w-8 rounded-lg bg-black/5 flex items-center justify-center active:scale-95 transition">
          <ChevronLeft className="h-4 w-4 text-black/70" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-extrabold tracking-[0.18em] text-black/40">{atual ? "SEMANA ATUAL" : "SEMANA"}</p>
          <p className="text-[15px] font-extrabold text-black leading-tight">Semana {semanaNum}</p>
        </div>
        <button type="button" onClick={() => onMudar(1)} aria-label="Próxima semana" className="h-8 w-8 rounded-lg bg-black/5 flex items-center justify-center active:scale-95 transition">
          <ChevronRight className="h-4 w-4 text-black/70" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {dias.map((d, i) => {
          const data = new Date(monday);
          data.setDate(monday.getDate() + i);
          const key = ymd(data);
          const sel = key === diaSel;
          const isHoje = key === hojeStr;
          const tem = comTreino.has(key);
          return (
            <button key={d} type="button" onClick={() => onSelect(key)} className="flex flex-col items-center gap-1">
              <span className={`text-[9px] font-extrabold tracking-[0.12em] ${sel ? "text-black" : "text-black/40"}`}>{d}</span>
              <span
                className={`h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-extrabold transition ${
                  sel ? "bg-black text-white" : tem ? "text-[#0033FF] bg-white" : "bg-black/5 text-black/50"
                }`}
                style={tem && !sel ? { boxShadow: "inset 0 0 0 1.5px #0033FF" } : undefined}
              >
                {data.getDate()}
              </span>
              <span className={`h-1 w-1 rounded-full ${isHoje ? "bg-[#FACC15]" : tem ? "bg-[#0033FF]" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
