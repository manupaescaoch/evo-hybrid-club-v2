import { createHmac, timingSafeEqual } from "crypto";
import { alunoSessionConfig } from "./aluno-session.server";

// Token assinado (HMAC) usado como alternativa ao cookie quando a prévia
// bloqueia cookies de terceiros.
const TTL_MS = 1000 * 60 * 60 * 24 * 30;

function sign(body: string) {
  return createHmac("sha256", alunoSessionConfig().password).update(body).digest("base64url");
}

export function criarAlunoToken(alunoId: string): string {
  const body = Buffer.from(JSON.stringify({ a: alunoId, e: Date.now() + TTL_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verificarAlunoToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const exp = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (exp.length !== got.length || !timingSafeEqual(exp, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof p?.a !== "string" || typeof p?.e !== "number" || p.e < Date.now()) return null;
    return p.a;
  } catch {
    return null;
  }
}
