import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IVAAliquotasManager } from "./IVAAliquotasManager";
import { IVAApuracaoResumo } from "./IVAApuracaoResumo";
import { IVASimulador } from "./IVASimulador";

export function IVADualTab() {
  return (
    <Tabs defaultValue="aliquotas" className="w-full">
      <TabsList>
        <TabsTrigger value="aliquotas">Alíquotas</TabsTrigger>
        <TabsTrigger value="apuracao">Apuração</TabsTrigger>
        <TabsTrigger value="simulacao">Simulação</TabsTrigger>
      </TabsList>

      <TabsContent value="aliquotas">
        <IVAAliquotasManager />
      </TabsContent>

      <TabsContent value="apuracao">
        <IVAApuracaoResumo />
      </TabsContent>

      <TabsContent value="simulacao">
        <IVASimulador />
      </TabsContent>
    </Tabs>
  );
}
