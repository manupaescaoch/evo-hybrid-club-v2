import { createFileRoute } from "@tanstack/react-router";
import { PublicFormularioPublico } from "@/components/publico/PublicFormularioPublico";

export const Route = createFileRoute("/feedback-mensal")({
  head: () => ({
    meta: [
      { title: "Feedback Mensal | EVO HYBRID CLUB" },
      { name: "description", content: "Envie seu feedback mensal de evolução para a equipe EVO HYBRID CLUB e mantenha sua consultoria atualizada." },
    ],
  }),
  component: FeedbackMensalPublicaPage,
});

function FeedbackMensalPublicaPage() {
  return <PublicFormularioPublico tipo="feedback_mensal" />;
}