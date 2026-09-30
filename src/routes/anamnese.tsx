import { createFileRoute } from "@tanstack/react-router";
import { PublicFormularioPublico } from "@/components/publico/PublicFormularioPublico";

export const Route = createFileRoute("/anamnese")({
  head: () => ({
    meta: [
      { title: "Anamnese Inicial | EVO HYBRID CLUB" },
      { name: "description", content: "Preencha sua anamnese inicial para a consultoria EVO HYBRID CLUB." },
    ],
  }),
  component: AnamnesePublicaPage,
});

function AnamnesePublicaPage() {
  return <PublicFormularioPublico tipo="anamnese" />;
}