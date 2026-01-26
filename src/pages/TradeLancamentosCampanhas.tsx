import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { List, Users, Download, Upload, Plus } from "lucide-react";
import { CampaignResultsPanel } from "@/components/trade/campaigns/CampaignResultsPanel";
import { CampaignClientTable } from "@/components/trade/campaigns/CampaignClientTable";
import { useNavigate } from "react-router-dom";

export default function TradeLancamentosCampanhas() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("todos");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Painel de Lançamentos</h1>
            <p className="text-muted-foreground mt-1">
              Visualize e gerencie todos os lançamentos de campanhas
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => navigate("/dashboard/trade/financeiro/campanhas")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="todos" className="gap-2">
              <List className="h-4 w-4" />
              Todos os Lançamentos
            </TabsTrigger>
            <TabsTrigger value="por-cliente" className="gap-2">
              <Users className="h-4 w-4" />
              Por Cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todos" className="space-y-4">
            <CampaignResultsPanel />
          </TabsContent>

          <TabsContent value="por-cliente" className="space-y-4">
            <CampaignClientTable />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
