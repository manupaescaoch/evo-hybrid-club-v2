import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, User, Library } from "lucide-react";
import { PerfilCorridaTab } from "./treino/PerfilCorridaTab";
import { PlanoSemanalTab } from "./treino/PlanoSemanalTab";
import { BibliotecaSessoesTab } from "./treino/BibliotecaSessoesTab";
import type { PerfilCorrida } from "@/lib/corrida-zonas";

export function TreinoTab({
  alunoId,
}: {
  alunoId: string;
  nomeAluno: string;
  whatsapp?: string | null;
}) {
  const [perfil, setPerfil] = useState<PerfilCorrida>({
    fc_max: null,
    fc_repouso: null,
    pace_limiar_seg: null,
  });

  return (
    <Tabs defaultValue="plano" className="w-full">
      <TabsList className="grid grid-cols-3 w-full max-w-md">
        <TabsTrigger value="plano" className="gap-1.5">
          <Dumbbell className="h-3.5 w-3.5" /> Plano
        </TabsTrigger>
        <TabsTrigger value="perfil" className="gap-1.5">
          <User className="h-3.5 w-3.5" /> Perfil
        </TabsTrigger>
        <TabsTrigger value="biblioteca" className="gap-1.5">
          <Library className="h-3.5 w-3.5" /> Biblioteca
        </TabsTrigger>
      </TabsList>

      <TabsContent value="plano" className="mt-5">
        <PlanoSemanalTab alunoId={alunoId} perfil={perfil} />
      </TabsContent>

      <TabsContent value="perfil" className="mt-5">
        <PerfilCorridaTab alunoId={alunoId} onChange={setPerfil} />
      </TabsContent>

      <TabsContent value="biblioteca" className="mt-5">
        <BibliotecaSessoesTab />
      </TabsContent>
    </Tabs>
  );
}
