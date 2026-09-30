import { createFileRoute } from "@tanstack/react-router";
import { runMotorAutomacoes } from "@/backend/motor.functions";

/**
 * Endpoint chamado por pg_cron / scheduler externo para rodar o motor
 * de automações. Validação por bearer com o publishable key (mesmo padrão
 * usado em outros hooks públicos do projeto).
 *
 * Cron NÃO é configurado por padrão — basta chamar este endpoint quando o
 * admin habilitar MOTOR_ATIVO. Para teste manual, passar `?force=1`.
 */
export const Route = createFileRoute("/api/public/hooks/motor-automacoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || "";
        if (!expected || auth !== `Bearer ${expected}`) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";
        try {
          const r = await runMotorAutomacoes({ data: { force } });
          return new Response(JSON.stringify(r), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});