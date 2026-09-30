import { createFileRoute } from "@tanstack/react-router";
import { gerarLembretesFeedbackPendentes } from "@/backend/feedback-lembretes.functions";

/**
 * Cron diário: gera jobs feedback_link_lembrete para formulários enviados há
 * 3+ dias e ainda sem resposta. Os jobs serão executados pelo motor.
 */
export const Route = createFileRoute("/api/public/hooks/feedback-lembretes")({
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
        try {
          const r = await gerarLembretesFeedbackPendentes();
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