import { createFileRoute } from "@tanstack/react-router";
import { PublicFormularioPublico } from "@/components/publico/PublicFormularioPublico";

export const Route = createFileRoute("/feedback-quinzenal")({
  head: () => ({
    meta: [
      { title: "Feedback Quinzenal | EVO HYBRID CLUB" },
      { name: "description", content: "Envie seu feedback quinzenal para a equipe EVO HYBRID CLUB." },
    ],
  }),
  component: FeedbackQuinzenalPublicaPage,
});

function FeedbackQuinzenalPublicaPage() {
  return <PublicFormularioPublico tipo="feedback_quinzenal" />;
}