import { createFileRoute } from "@tanstack/react-router";
import { processarJobsRespostaFeedback } from "@/backend/notificacoes-formularios.functions";

function checkAuth(request: Request): Response | null {
  const auth = request.headers.get("authorization") || "";
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export const Route = createFileRoute("/api/public/hooks/processar-jobs-feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkAuth(request);
        if (unauth) return unauth;
        const result = await processarJobsRespostaFeedback();
        return new Response(JSON.stringify(result), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
      GET: async ({ request }) => {
        const unauth = checkAuth(request);
        if (unauth) return unauth;
        const result = await processarJobsRespostaFeedback();
        return new Response(JSON.stringify(result), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});