import { createFileRoute } from "@tanstack/react-router";

// Conversas/inbox foram removidas do sistema. Mantemos o endpoint para que a
// Z-API não receba 404 caso o webhook continue configurado externamente.

export const Route = createFileRoute("/api/public/hooks/zapi-mensagem-enviada")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(JSON.stringify({ ok: true, ignorado: "inbox-desativado" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(
          JSON.stringify({ ok: true, info: "Inbox desativado." }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    },
  },
});
