import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { SocialMediaCharts } from "./SocialMediaCharts";
import { SocialMediaSentiment } from "./SocialMediaSentiment";
import { MultiAccountDashboard } from "./social/MultiAccountDashboard";

export const SocialMediaMonitoring = () => {
  const [activeTab, setActiveTab] = useState("accounts");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accounts">Gerenciar Contas</TabsTrigger>
          <TabsTrigger value="realtime">Métricas em Tempo Real (Legacy)</TabsTrigger>
          <TabsTrigger value="charts">Gráficos de Evolução</TabsTrigger>
          <TabsTrigger value="sentiment">Análise de Sentimento</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6">
          <MultiAccountDashboard />
        </TabsContent>

        <TabsContent value="realtime" className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta aba está obsoleta. Use a aba "Gerenciar Contas" para gerenciar múltiplas contas de redes sociais com funcionalidades avançadas.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <SocialMediaCharts />
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-6">
          <SocialMediaSentiment />
        </TabsContent>
      </Tabs>
    </div>
  );
};
