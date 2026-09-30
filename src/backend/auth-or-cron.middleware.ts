import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Aceita duas formas de autenticação:
 *  - Bearer com SUPABASE_PUBLISHABLE_KEY (uso interno por rotas /api/public/hooks/* — cron)
 *  - Bearer com JWT de usuário Supabase (uso pelo app autenticado)
 * Qualquer outra requisição é bloqueada (401).
 */
export const requireAuthOrCron = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Response("Missing Supabase env vars", { status: 500 });
    }

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    type Ctx = { isCron: boolean; userId: string | null };
    // Cron path: bearer == publishable key (mesmo padrão dos hooks públicos)
    if (token === SUPABASE_PUBLISHABLE_KEY) {
      const ctx: Ctx = { isCron: true, userId: null };
      return next({ context: ctx });
    }

    // App autenticado: valida JWT do usuário
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const ctx: Ctx = { isCron: false, userId: data.claims.sub };
    return next({ context: ctx });
  },
);