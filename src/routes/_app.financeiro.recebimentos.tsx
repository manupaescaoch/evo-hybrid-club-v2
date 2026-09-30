import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VendasPage } from "./_app.financeiro.vendas";
import { ClientesPage } from "./_app.financeiro.clientes";

const searchSchema = z.object({
  tab: z.enum(["vendas", "clientes"]).optional(),
});

export const Route = createFileRoute("/_app/financeiro/recebimentos")({
  component: RecebimentosPage,
  validateSearch: (s) => searchSchema.parse(s),
});

function RecebimentosPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const active = tab ?? "vendas";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recebimentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vendas e clientes ativos do período.
        </p>
      </div>
      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({
            to: "/financeiro/recebimentos",
            search: { tab: v as "vendas" | "clientes" },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>
        <TabsContent value="vendas" className="mt-6">
          <VendasPage />
        </TabsContent>
        <TabsContent value="clientes" className="mt-6">
          <ClientesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}