import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Zap,
  Flame,
  Droplet,
  Moon,
  Smile,
  ChevronRight,
  Check,
  Bell,
  Utensils,
  Footprints,
  Clock,
  MapPin,
  HeartPulse,
  Play,
  BarChart3,
  Footprints as Shoe,
} from "lucide-react";
import { useAlunoSession } from "@/lib/aluno-session";
import { useAlunoDashboard, triggerAlunoDashboardRefetch } from "@/lib/aluno-dashboard-store";
import { useServerFn } from "@tanstack/react-start";
import { getDietaAluno } from "@/backend/aluno-dieta.functions";
import { getSemanaTreinoAluno, type AlunoTreinoSessao } from "@/backend/aluno-treino.functions";
import { registrarAgua } from "@/backend/aluno-kpis.functions";
import { SCORE_DIARIO, SCORE_META_SEMANAL, somarScoreJanela } from "@/lib/aluno-score";

export const Route = createFileRoute("/aluno/")({
  head: () => ({
    meta: [
      { title: "Início — App do Aluno | EVO HYBRID CLUB" },
      { name: "description", content: "Sua página inicial no EVO HYBRID CLUB: score do dia, check-in diário, dieta, WODs e evolução em um só lugar." },
    ],
  }),
  component: AlunoInicio,
});

const RED = "#0033FF";

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const safePct = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const off = c - (safePct / 100) * c;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

function calcSequencia(datas: string[]) {
  if (!datas.length) return 0;
  const set = new Set(datas);
  let d = new Date();
  const hoje = d.toISOString().slice(0, 10);
  if (!set.has(hoje)) d.setDate(d.getDate() - 1);
  let streak = 0;
  for (;;) {
    const k = d.toISOString().slice(0, 10);
    if (set.has(k)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function humorTexto(h?: number | null) {
  if (h == null) return null;
  if (h >= 4) return "Muito bem";
  if (h === 3) return "Bem";
  if (h === 2) return "Ok";
  if (h === 1) return "Cansado";
  return "Difícil";
}
function energiaTexto(e?: number | null) {
  if (e == null) return null;
  if (e >= 4) return "Alta";
  if (e === 3) return "Boa";
  if (e === 2) return "Média";
  return "Baixa";
}

function AlunoInicio() {
  const { session } = useAlunoSession();
  const primeiroNome = (session?.nome ?? "Aluno").split(" ")[0];
  const { data, loading } = useAlunoDashboard();
  const fetchDieta = useServerFn(getDietaAluno);
  const fnRegistrarAgua = useServerFn(registrarAgua);
  

  const [refeicoesTotal, setRefeicoesTotal] = useState<number>(0);
  const [metaKcal, setMetaKcal] = useState<number | null>(null);
  const [totalKcal, setTotalKcal] = useState<number | null>(null);
  const [refeicoesKcal, setRefeicoesKcal] = useState<Record<string, number>>({});

  const [scoreToast, setScoreToast] = useState<number | null>(null);
  const aguaMlServer = (data as any)?.agua_ml_hoje ?? 0;
  const [aguaOptimistic, setAguaOptimistic] = useState<number | null>(null);
  useEffect(() => {
    setAguaOptimistic(null);
  }, [aguaMlServer]);
  const aguaMl = aguaOptimistic ?? aguaMlServer;
  const refeicoesFeitas = ((data as any)?.refeicoes_hoje ?? []).length as number;
  const refeicoesHojeIds: string[] = ((data as any)?.refeicoes_hoje ?? [])
    .map((r: any) => r?.refeicao_id)
    .filter((x: any): x is string => !!x);
  const kcalConsumido = refeicoesHojeIds.reduce(
    (s, id) => s + (refeicoesKcal[id] ?? 0),
    0,
  );

  const ajustarAgua = (delta: number) => {
    if (!session?.id) return;
    const base = aguaOptimistic ?? aguaMlServer;
    const novoTotal = Math.max(0, base + delta);
    const realDelta = novoTotal - base;
    if (realDelta === 0) return;
    setAguaOptimistic(novoTotal);
    fnRegistrarAgua({ data: { ml: realDelta } })
      .then(() => triggerAlunoDashboardRefetch())
      .catch(() => setAguaOptimistic(null));
  };

  useEffect(() => {
    if (!session?.id) return;
    let cancel = false;
    fetchDieta()
      .then((r) => {
        if (cancel) return;
        setRefeicoesTotal(r.plano?.refeicoes.length ?? 0);
        setMetaKcal(r.plano?.meta_kcal ?? null);
        const kcalCalc = r.plano?.totais?.kcal ?? 0;
        const kcalDesc = r.plano?.totais_descricao?.kcal ?? 0;
        setTotalKcal(kcalCalc > 0 ? kcalCalc : kcalDesc > 0 ? kcalDesc : null);
        const map: Record<string, number> = {};
        for (const ref of r.plano?.refeicoes ?? []) {
          map[ref.id] = Number(ref.totais?.kcal ?? 0);
        }
        setRefeicoesKcal(map);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [session?.id, fetchDieta]);

  const checkins = data?.checkins ?? [];
  const hojeStr = new Date().toISOString().slice(0, 10);
  const checkinHoje = checkins.find((c: any) => c.data_checkin === hojeStr);
  const sequencia = useMemo(
    () => calcSequencia(checkins.map((c: any) => c.data_checkin)),
    [checkins],
  );

  // Score acumulado da janela (últimos 7 dias). Constantes compartilhadas
  // com a tela de perfil em src/lib/aluno-score.ts.
  const xpHoje = checkinHoje?.score_gerado ?? 0;
  const xpSemana = somarScoreJanela(checkins);
  const xpMetaDia = SCORE_DIARIO;
  const xpMetaSemana = SCORE_META_SEMANAL;
  const pct = Math.min(100, Math.round((xpHoje / xpMetaDia) * 100));
  const xpFalta = Math.max(0, xpMetaDia - xpHoje);

  const sono = checkinHoje?.sono_horas ?? null;
  const sonoMeta = 8;
  const sonoPct = sono ? Math.min(100, Math.round((sono / sonoMeta) * 100)) : 0;
  const humor = humorTexto(checkinHoje?.humor);
  const energia = energiaTexto(checkinHoje?.energia);

  const inicial = (session?.nome ?? "A").trim().charAt(0).toUpperCase();
  const pesoKg = (data?.aluno as any)?.peso_kg ? Number((data?.aluno as any).peso_kg) : null;
  const aguaMetaMl = pesoKg ? Math.round(pesoKg * 35) : null;
  const aguaMetaL = aguaMetaMl ? aguaMetaMl / 1000 : null;
  const aguaAtualL = aguaMl / 1000;
  const aguaPct = aguaMetaMl ? Math.min(100, Math.round((aguaMl / aguaMetaMl) * 100)) : 0;
  const metaKcalRef = metaKcal ?? totalKcal ?? null;
  const kcalConsumidoArred = Math.round(kcalConsumido);
  const kcalLabel = metaKcalRef
    ? `${Math.round(metaKcalRef).toLocaleString("pt-BR")}`
    : kcalConsumidoArred > 0
    ? `${kcalConsumidoArred.toLocaleString("pt-BR")}`
    : "—";
  const kcalSubtitle = metaKcalRef
    ? `kcal do plano`
    : kcalConsumidoArred > 0
    ? "kcal consumidas"
    : "sem meta";

  const dietaPct = refeicoesTotal > 0 ? Math.round((refeicoesFeitas / refeicoesTotal) * 100) : 0;

  const showScore = (v: number) => {
    setScoreToast(v);
    setTimeout(() => setScoreToast(null), 1500);
  };

  const focos = [
    { label: "Check-in", icon: Check, color: RED, done: !!checkinHoje },
    { label: "Sono", icon: Moon, color: "#7B5BFF", done: !!sono },
    { label: "Humor", icon: Smile, color: "#22C55E", done: checkinHoje?.humor != null },
    { label: "Dieta", icon: Utensils, color: "#22C55E", done: false },
  ];
  const focosFeitos = focos.filter((f) => f.done).length;

  return (
    <div className="px-4 pt-3 pb-2 space-y-3">
      {/* Saudação */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-3"
      >
        <div>
          <h1 className="text-[28px] leading-[1.05] font-black tracking-tight text-black">
            Olá, <span className="uppercase">{primeiroNome}</span>
          </h1>
          <p className="mt-1 text-[13px] text-black/55">Corrida, constância e evolução.</p>
        </div>
        <Link to="/aluno/perfil" className="relative shrink-0" aria-label="Perfil">
          <div className="h-11 w-11 rounded-full bg-[#0033FF]/10 overflow-hidden ring-1 ring-black/5 flex items-center justify-center">
            {session?.avatarUrl ? (
              <img src={session.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[15px] font-extrabold text-[#0033FF]">{inicial}</span>
            )}
          </div>
        </Link>
      </motion.section>

      {/* Resumo do dia: Score / Sequência / Meta do dia */}
      {/* CARD 1 — Score de hoje (destaque máximo) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-[28px] bg-white p-5 border border-[#EAEAEA] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-[#0033FF]/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-[#0033FF]" fill="#0033FF" />
            </div>
            <span className="text-[12px] font-extrabold tracking-[0.2em] text-[#111111]">
              SCORE DE HOJE
            </span>
          </div>
          <div className="text-[15px] font-extrabold text-[#0033FF] tabular-nums shrink-0">
            {xpSemana} <span className="font-bold text-[13px]">na semana</span>
          </div>
        </div>

        <div className="mt-4 h-3 w-full rounded-full bg-[#0033FF]/10 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="h-full rounded-full bg-[#0033FF]"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[15px] font-extrabold text-[#0033FF] tabular-nums">
            {xpHoje} / {xpMetaDia} pts
          </span>
          <span className="text-[13px] font-medium text-black/55 text-right">
            {xpFalta > 0 ? `Faltam ${xpFalta} pts hoje` : "Meta de hoje batida"}
          </span>
        </div>
      </motion.section>

      {/* CARD 2 — Sequência / Streak */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="rounded-[28px] bg-white p-5 border border-[#EAEAEA] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] flex items-center gap-4"
      >
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-12 w-12 rounded-full bg-[#0033FF]/10 flex items-center justify-center">
            <Flame className="h-6 w-6 text-[#0033FF]" fill="#0033FF" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-black leading-none text-[#0033FF] tabular-nums">
              {sequencia}
            </span>
            <span className="text-[10px] font-extrabold tracking-[0.18em] leading-tight text-[#111111]">
              DIAS<br />SEGUIDOS
            </span>
          </div>
        </div>
        <div className="h-10 w-px bg-black/10" />
        <p className="flex-1 text-[14px] leading-snug text-[#444444] font-medium">
          {sequencia === 0
            ? "Faça seu check-in de hoje pra começar a contagem."
            : "Tu sobe aqui fazendo o básico todo dia."}
        </p>
        <ChevronRight className="h-5 w-5 text-[#0033FF] shrink-0" strokeWidth={2.5} />
      </motion.section>

      {/* Treino de hoje */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-[11px] font-extrabold tracking-[0.2em] text-black">
            WOD DE HOJE
          </h2>
          <Link
            to="/aluno/treino"
            className="text-[12px] font-semibold text-[#0033FF] inline-flex items-center gap-0.5"
          >
            Ver tudo <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <TreinoHojeCard />
      </motion.section>

      {/* Check-in de hoje (compacto) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="rounded-2xl bg-white px-3 py-2 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-black/5 flex items-center gap-2.5"
      >
        <div className="h-8 w-8 rounded-full bg-[#0033FF]/10 flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-[#0033FF]" strokeWidth={3} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-extrabold tracking-[0.18em] text-black/70">
            CHECK-IN DE HOJE
          </div>
          <div className="text-[13px] font-extrabold leading-tight text-[#0033FF] tabular-nums">
            {focosFeitos} de {focos.length} concluídos
          </div>
        </div>
        <Link
          to="/aluno/perfil"
          className="shrink-0 inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-[#0033FF] text-[#0033FF] text-[11px] font-extrabold tracking-tight active:scale-95 transition"
        >
          Finalizar
        </Link>
      </motion.section>

      {/* Indicadores do corpo */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-[12px] font-extrabold tracking-[0.22em] text-black">HOJE</h2>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard
            label="Sono"
            icon={Moon}
            color="#7B5BFF"
            bg="bg-[#7B5BFF]/10"
            value={sono ? `${sono}h` : "—"}
            subtitle={sono ? `/ ${sonoMeta}h` : "sem registro"}
            ringPct={sonoPct}
            index={0}
          />
          <MetricCard
            label="Energia"
            icon={Zap}
            color="#F5B400"
            bg="bg-[#F5B400]/10"
            value={energia ?? "—"}
            subtitle={energia ? "" : "registre hoje"}
            check={!!energia}
            fillIcon
            index={1}
          />
          <AguaCard
            atualL={aguaAtualL}
            metaL={aguaMetaL}
            pct={aguaPct}
            onAdd={() => ajustarAgua(250)}
            onSub={() => ajustarAgua(-250)}
          />
          <MetricCard
            label="Humor"
            icon={Smile}
            color="#22C55E"
            bg="bg-[#22C55E]/10"
            value={humor ?? "—"}
            subtitle={humor ? "" : "registre hoje"}
            check={!!humor}
            index={2}
          />
          <MetricCard
            label="Calorias"
            icon={Flame}
            color={RED}
            bg="bg-[#0033FF]/10"
            value={kcalLabel}
            subtitle={kcalSubtitle}
            ringPct={dietaPct}
            fillIcon
            index={3}
          />
          <MetricCard
            label="Pace médio"
            icon={Clock}
            color={RED}
            bg="bg-[#0033FF]/10"
            value="5:12/km"
            subtitle="esta semana"
            ringPct={72}
            index={4}
          />
        </div>
      </section>

      {/* Performance da semana */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-[12px] font-extrabold tracking-[0.22em] text-black">
            PERFORMANCE DA SEMANA
          </h2>
        </div>
        <Link
          to="/aluno/perfil"
          className="block rounded-2xl bg-white p-3 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-black/5 active:scale-[0.99] transition"
        >
          <div className="flex items-stretch">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <BarChart3 className="h-7 w-7 text-[#0033FF]" strokeWidth={2.5} />
              <div className="min-w-0">
                <div className="text-[18px] font-extrabold leading-none text-black tabular-nums">24 km</div>
                <div className="text-[11px] text-black/55 mt-1">Distância total</div>
              </div>
            </div>
            <div className="w-px bg-black/10 mx-2" />
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Shoe className="h-7 w-7 text-[#0033FF]" strokeWidth={2.5} />
              <div className="min-w-0">
                <div className="text-[18px] font-extrabold leading-none text-black tabular-nums">3 WODs</div>
                <div className="text-[11px] text-black/55 mt-1">WODs concluídos</div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-black/30 self-center ml-1 shrink-0" />
          </div>
        </Link>
      </section>

      <AnimatePresence>
        {scoreToast !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-full bg-black text-white px-4 py-2 text-[13px] font-bold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]"
          >
            +{scoreToast} Score
          </motion.div>
        )}
      </AnimatePresence>
      {loading && !data && (
        <p className="text-center text-[11px] text-black/35 font-medium pt-2">
          Carregando seus dados…
        </p>
      )}
    </div>
  );
}

function MetricCard({
  label,
  icon: Icon,
  color,
  bg,
  value,
  subtitle,
  ringPct,
  check,
  fillIcon,
  index,
}: {
  label: string;
  icon: typeof Flame;
  color: string;
  bg: string;
  value: string;
  subtitle?: string;
  ringPct?: number;
  check?: boolean;
  fillIcon?: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 * index }}
      className="rounded-2xl bg-white p-3 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.18)] ring-1 ring-black/5 flex items-center gap-2"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4" style={{ color }} fill={fillIcon ? color : "none"} strokeWidth={2.5} />
          <span className="text-[11px] font-semibold text-black/60">{label}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-[20px] font-extrabold leading-none text-black tabular-nums truncate">{value}</span>
          {subtitle && <span className="text-[11px] text-black/40 truncate">{subtitle}</span>}
        </div>
      </div>
      {check ? (
        <div className="h-8 w-8 rounded-full border-2 border-[#22C55E]/40 flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-[#22C55E]" strokeWidth={3} />
        </div>
      ) : (
        <Ring pct={ringPct ?? 0} color={color} />
      )}
    </motion.div>
  );
}

function AguaCard({
  atualL,
  metaL,
  pct,
  onAdd,
  onSub,
}: {
  atualL: number;
  metaL: number | null;
  pct: number;
  onAdd: () => void;
  onSub: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 }}
      className="rounded-2xl bg-white p-3 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.18)] ring-1 ring-black/5 flex items-center gap-2"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Droplet className="h-4 w-4 text-[#0EA5E9]" fill="#0EA5E9" />
          <span className="text-[11px] font-semibold text-black/60">Água</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-[20px] font-extrabold leading-none text-black tabular-nums">
            {atualL.toFixed(1).replace(".", ",")}L
          </span>
          <span className="text-[11px] text-black/40 tabular-nums">
            {metaL ? `/ ${metaL.toFixed(1).replace(".", ",")}L` : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onSub}
          className="h-8 w-8 rounded-full bg-black/5 text-black text-[18px] leading-none font-bold active:scale-90 transition-transform flex items-center justify-center"
          aria-label="Remover 250ml"
        >
          −
        </button>
        <button
          onClick={onAdd}
          className="h-8 w-8 rounded-full bg-[#0033FF] text-white text-[18px] leading-none font-bold active:scale-90 transition-transform flex items-center justify-center"
          aria-label="Adicionar 250ml"
        >
          +
        </button>
      </div>
    </motion.div>
  );
}

function ActionCard({
  label,
  icon: Icon,
  color,
  bg,
  valueLabel,
  buttonLabel,
  done,
  onDone,
  doneLabel,
  index,
  glow,
}: {
  label: string;
  icon: typeof Flame;
  color: string;
  bg: string;
  valueLabel: string;
  buttonLabel: string;
  done: boolean;
  onDone: () => void;
  doneLabel: string;
  index: number;
  glow?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow:
          done && glow
            ? `0 0 0 1px ${color}33, 0 12px 30px -12px ${color}66`
            : "0 8px 24px -16px rgba(0,0,0,0.18)",
      }}
      transition={{ duration: 0.3, delay: 0.04 * index }}
      className="relative rounded-2xl bg-white p-3 ring-1 ring-black/5 min-h-[86px] flex flex-col overflow-hidden"
    >
      <div className="flex items-center gap-1.5">
        <div className={`h-5 w-5 rounded-md flex items-center justify-center ${bg}`}>
          <Icon className="h-3 w-3" style={{ color }} />
        </div>
        <span className="text-[11px] font-bold text-black">{label}</span>
      </div>
      <div className="text-[11px] text-black/55 mt-1.5 truncate">{valueLabel}</div>
      <div className="mt-auto pt-2">
        {done ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-[#22C55E]/10 px-2 py-1.5">
            <span className="h-4 w-4 rounded-full bg-[#22C55E] flex items-center justify-center shrink-0">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
            </span>
            <span className="text-[10px] font-bold text-[#16a34a] truncate">{doneLabel}</span>
          </div>
        ) : (
          <button
            onClick={onDone}
            className="w-full rounded-xl bg-black text-white text-[11px] font-bold py-1.5 active:scale-[0.98] transition"
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}


function TreinoHojeCard() {
  const fetchSemana = useServerFn(getSemanaTreinoAluno);
  const [sessoes, setSessoes] = useState<AlunoTreinoSessao[] | null>(null);
  useEffect(() => {
    const d = new Date();
    const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    fetchSemana({ data: { inicio: hoje, fim: hoje } })
      .then((r) => setSessoes((Array.isArray(r?.sessoes) ? r.sessoes : []).filter((s) => s.tipo !== "descanso")))
      .catch(() => setSessoes([]));
  }, [fetchSemana]);

  if (sessoes === null) {
    return <div className="rounded-2xl bg-white p-6 text-center text-[12px] text-black/50 ring-1 ring-black/5">Carregando WOD...</div>;
  }
  if (sessoes.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-black/5">
        <p className="text-[16px] font-extrabold text-black">Dia de descanso</p>
        <p className="text-[12px] text-black/55 mt-1">Nenhum WOD programado para hoje.</p>
      </div>
    );
  }
  const s = sessoes[0];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0033FF]/10 px-3 py-1">
        <Footprints className="h-3.5 w-3.5 text-[#0033FF]" />
        <span className="text-[11px] font-extrabold tracking-[0.16em] text-[#0033FF] uppercase">{s.tipo}</span>
      </div>
      <h3 className="mt-3 text-[22px] font-black leading-tight tracking-tight text-black">{s.nome}</h3>
      {s.objetivo && <p className="mt-1 text-[13px] text-black/55">{s.objetivo}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-black/70">
        {s.duracao_min != null && (
          <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-black/55" /><span className="font-semibold">{s.duracao_min} min</span></span>
        )}
        {s.distancia_km != null && (
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-black/55" /><span className="font-semibold">{Number(s.distancia_km)} km</span></span>
        )}
        {s.zona_fc && (
          <span className="inline-flex items-center gap-1.5"><HeartPulse className="h-4 w-4 text-black/55" /><span className="font-semibold">{s.zona_fc}</span></span>
        )}
      </div>
      {sessoes.length > 1 && (
        <p className="mt-2 text-[12px] font-semibold text-[#0033FF]">+ {sessoes.length - 1} {sessoes.length - 1 === 1 ? "outro WOD" : "outros WODs"} hoje</p>
      )}
      <Link
        to="/aluno/treino"
        className="mt-4 w-full inline-flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#0033FF] text-white text-[15px] font-extrabold tracking-tight active:scale-[0.99] transition shadow-[0_12px_28px_-12px_rgba(0,51,255,0.55)]"
      >
        <Play className="h-4 w-4" fill="#fff" />
        Iniciar WOD
      </Link>
    </div>
  );
}
