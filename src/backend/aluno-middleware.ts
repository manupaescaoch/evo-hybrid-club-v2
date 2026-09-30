import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { getAlunoSessionServer, type AlunoSessionData } from "./aluno-session.server";
export type { AlunoSessionData } from "./aluno-session.server";

const TOKEN_KEY = "evo_aluno_token";

/** Resolve o aluno pelo cookie; se o cookie foi bloqueado, usa o token do cabeçalho. */
async function resolverAluno(): Promise<{ alunoId: string | null; data: AlunoSessionData }> {
  try {
    const session = await getAlunoSessionServer();
    if (session.data?.aluno_id) return { alunoId: session.data.aluno_id, data: session.data };
  } catch {
    // segue para o token
  }
  const { verificarAlunoToken } = await import("./aluno-token.server");
  const alunoId = verificarAlunoToken(getRequestHeader("x-aluno-token"));
  if (!alunoId) return { alunoId: null, data: {} };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acesso } = await supabaseAdmin
    .from("alunos_acesso")
    .select("deve_trocar_senha")
    .eq("aluno_id", alunoId)
    .maybeSingle();
  if (!acesso) return { alunoId: null, data: {} };
  return { alunoId, data: { aluno_id: alunoId, deve_trocar_senha: !!acesso.deve_trocar_senha } };
}

const anexarToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  let token: string | null = null;
  try {
    token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  } catch {}
  return next({ headers: token ? { "x-aluno-token": token } : {} });
});

/** Middleware obrigatório: garante aluno autenticado. */
export const requireAlunoAuth = createMiddleware({ type: "function" })
  .middleware([anexarToken])
  .server(async ({ next }) => {
    const { alunoId, data } = await resolverAluno();
    if (!alunoId) {
      throw new Response("Unauthorized: sessão de aluno inválida", { status: 401 });
    }
    if (data.deve_trocar_senha) {
      throw new Response("Troca de senha obrigatória antes de continuar", { status: 403 });
    }
    return next({ context: { alunoId, alunoSession: data } });
  });

/** Middleware: aluno autenticado, mas permite chamadas com `deve_trocar_senha`. */
export const requireAlunoAuthAllowPending = createMiddleware({ type: "function" })
  .middleware([anexarToken])
  .server(async ({ next }) => {
    const { alunoId, data } = await resolverAluno();
    if (!alunoId) {
      throw new Response("Unauthorized: sessão de aluno inválida", { status: 401 });
    }
    return next({ context: { alunoId, alunoSession: data } });
  });

/** Middleware opcional: injeta alunoId|null sem lançar. */
export const optionalAlunoAuth = createMiddleware({ type: "function" })
  .middleware([anexarToken])
  .server(async ({ next }) => {
    try {
      const { alunoId } = await resolverAluno();
      return next({ context: { alunoId } });
    } catch {
      return next({ context: { alunoId: null as string | null } });
    }
  });
