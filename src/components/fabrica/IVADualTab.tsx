import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IVAAliquotasManager } from "./IVAAliquotasManager";
import { IVAApuracaoResumo } from "./IVAApuracaoResumo";
import { IVASimulador } from "./IVASimulador";
import { NFSaidaCadastro } from "./NFSaidaCadastro";
import { NFSaidaListagem } from "./NFSaidaListagem";
import { ApuracaoFiscalConsolidada } from "./ApuracaoFiscalConsolidada";

export function IVADualTab() {
  const [saidaKey, setSaidaKey] = useState(0);

  return (
    <Tabs defaultValue="aliquotas" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="aliquotas">Alíquotas</TabsTrigger>
        <TabsTrigger value="apuracao">Apuração CBS/IBS</TabsTrigger>
        <TabsTrigger value="saidas">Notas de Saída</TabsTrigger>
        <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
        <TabsTrigger value="simulacao">Simulação</TabsTrigger>
      </TabsList>

      <TabsContent value="aliquotas">
        <IVAAliquotasManager />
      </TabsContent>

      <TabsContent value="apuracao">
        <IVAApuracaoResumo />
      </TabsContent>

      <TabsContent value="saidas">
        <div className="space-y-6">
          <NFSaidaCadastro onSuccess={() => setSaidaKey((k) => k + 1)} />
          <NFSaidaListagem key={saidaKey} />
        </div>
      </TabsContent>

      <TabsContent value="consolidado">
        <ApuracaoFiscalConsolidada />
      </TabsContent>

      <TabsContent value="simulacao">
        <IVASimulador />
      </TabsContent>
    </Tabs>
  );
}
