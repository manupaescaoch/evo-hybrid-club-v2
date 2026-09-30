import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, UserRound, Dumbbell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { setAlunoToken, setAlunoSession, getAlunoSession, clearAlunoSession } from "@/lib/aluno-session";
import { useServerFn } from "@tanstack/react-start";
import { loginAlunoPorEmail } from "@/lib/aluno-auth.functions";
import { Button } from "@/components/ui/button";
import mpTeamLogo from "@/assets/evo-hybrid-club-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — EVO HYBRID CLUB" },
      { name: "description", content: "Acesse sua conta EVO HYBRID CLUB." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signOut, session, loading } = useAuth();
  const nav = useNavigate();
  const [perfil, setPerfil] = useState<"aluno" | "treinador">("aluno");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loginAlunoFn = useServerFn(loginAlunoPorEmail);

  useEffect(() => {
    if (loading) return;
    if (getAlunoSession()) { nav({ to: "/aluno" }); return; }
    if (session) nav({ to: "/visao-geral" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    if (perfil === "treinador") {
      clearAlunoSession();
      const equipe = await signIn(email.trim(), password);
      setBusy(false);
      if (equipe.error) {
        setErr("E-mail ou senha do treinador inválidos");
        return;
      }
      nav({ to: "/visao-geral" });
      return;
    }

    try {
      const res = await loginAlunoFn({ data: { identificador: email.trim(), senha: password } });
      if (res.ok) {
        // Encerra sessão de treinador para não desviar ao painel admin
        await signOut().catch(() => {});
        if ((res as any).token) setAlunoToken((res as any).token);
        setAlunoSession({
          id: res.aluno.id,
          nome: res.aluno.nome,
          email: res.aluno.email,
          whatsapp: res.aluno.whatsapp,
          avatarUrl: (res.aluno as any).foto_url ?? null,
          deveTrocarSenha: res.deve_trocar_senha,
        });
        setBusy(false);
        nav({ to: res.deve_trocar_senha ? "/aluno/trocar-senha" : "/aluno" });
        return;
      }
    } catch {
      /* ignora */
    }

    setBusy(false);
    setErr("E-mail, WhatsApp ou senha do aluno inválidos");
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col items-center px-6 pt-12 pb-10">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo */}
        <div className="h-[110px] w-[110px] overflow-hidden rounded-[26px] bg-black flex items-center justify-center shadow-[0_22px_50px_-18px_rgba(0,51,255,0.55)]">
          <img
            src={mpTeamLogo.url}
            alt="EVO HYBRID CLUB"
            className="h-full w-full object-cover select-none"
            draggable={false}
          />
        </div>

        {/* Título */}
        <h1 className="mt-6 text-[32px] leading-none font-extrabold tracking-tight text-black text-center">
          <span className="text-[#0033FF]">EVO</span> HYBRID CLUB
        </h1>
        <p className="mt-3 text-[14px] text-black/55 text-center">
          Todo treino começa antes do primeiro passo.
        </p>

        {/* Formulário */}
        <form onSubmit={onSubmit} className="w-full mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]" aria-label="Tipo de acesso">
            <Button
              type="button"
              variant={perfil === "aluno" ? "default" : "ghost"}
              onClick={() => { setPerfil("aluno"); setErr(null); }}
              className="h-12 rounded-xl text-[15px]"
              aria-pressed={perfil === "aluno"}
            >
              <UserRound className="h-4 w-4" />
              Aluno
            </Button>
            <Button
              type="button"
              variant={perfil === "treinador" ? "default" : "ghost"}
              onClick={() => { setPerfil("treinador"); setErr(null); }}
              className="h-12 rounded-xl text-[15px]"
              aria-pressed={perfil === "treinador"}
            >
              <Dumbbell className="h-4 w-4" />
              Treinador
            </Button>
          </div>

          <div className="relative">
            <Mail className="h-5 w-5 text-[#0033FF] absolute left-5 top-1/2 -translate-y-1/2" strokeWidth={2.2} />
            <input
              type="text"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder={perfil === "aluno" ? "E-mail ou WhatsApp" : "E-mail"}
              className="w-full h-[60px] rounded-2xl bg-white border-0 pl-14 pr-5 text-[16px] placeholder:text-black/40 text-black shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[#0033FF]/30 transition"
            />
          </div>

          <div className="relative">
            <Lock className="h-5 w-5 text-[#0033FF] absolute left-5 top-1/2 -translate-y-1/2" strokeWidth={2.2} />
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              autoComplete="current-password"
              placeholder="Senha"
              className="w-full h-[60px] rounded-2xl bg-white border-0 pl-14 pr-14 text-[16px] placeholder:text-black/40 text-black shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[#0033FF]/30 transition"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70 transition"
              aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex justify-end pt-1">
            <Link
              to="/aluno/esqueci-senha"
              className="text-[14px] font-semibold text-[#0033FF] hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          {err && (
            <div className="text-[13px] text-[#0033FF] bg-[#0033FF]/5 border border-[#0033FF]/20 rounded-xl px-4 py-3">
              {err}
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full h-[60px] mt-2 rounded-2xl bg-[#0033FF] text-white text-[17px] font-bold shadow-[0_18px_40px_-12px_rgba(0,51,255,0.55)] hover:bg-[#0033FF]/95 active:scale-[0.99] disabled:opacity-50 transition-all"
          >
            {busy ? "Entrando..." : `Entrar como ${perfil === "aluno" ? "aluno" : "treinador"}`}
          </Button>
        </form>
      </div>
    </div>
  );
}
