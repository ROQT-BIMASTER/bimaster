import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshCw, Factory } from "lucide-react";
import { useFabricaExecutiveDashboard } from "@/hooks/useFabricaExecutiveDashboard";
import { FabricaExecutiveKPIs } from "@/components/fabrica/executive/FabricaExecutiveKPIs";
import { FabricaEvolutionChart } from "@/components/fabrica/executive/FabricaEvolutionChart";
import { FabricaTopMargens } from "@/components/fabrica/executive/FabricaTopMargens";
import { FabricaAlertasPanel } from "@/components/fabrica/executive/FabricaAlertasPanel";
import { FabricaCategoriasChart } from "@/components/fabrica/executive/FabricaCategoriasChart";
import { FabricaCustosMPTable } from "@/components/fabrica/executive/FabricaCustosMPTable";
import { ChartTabs } from "@/components/ui/chart-tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, BarChart3, Layers } from "lucide-react";

export default function FabricaExecutiveDashboard() {
  const { kpis, evolucao, produtosPorMargem, alertas, categorias, custosMP, isLoading, refetch } =
    useFabricaExecutiveDashboard();

  const tabs = [
    {
      key: "evolucao",
      label: "Evolução",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      content: <FabricaEvolutionChart evolucao={evolucao} />,
    },
    {
      key: "margens",
      label: "Margens",
      icon: <BarChart3 className="h-3.5 w-3.5" />,
      content: (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FabricaTopMargens melhores={produtosPorMargem.melhores} piores={produtosPorMargem.piores} />
          </div>
          <div>
            <FabricaAlertasPanel alertas={alertas} />
          </div>
        </div>
      ),
    },
    {
      key: "categorias",
      label: "Categorias & MPs",
      icon: <Layers className="h-3.5 w-3.5" />,
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          <FabricaCategoriasChart categorias={categorias} />
          <FabricaCustosMPTable materiasPrimas={custosMP} />
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          icon={Factory}
          title="Visão Executiva - Fábrica"
          description={`Análise consolidada · ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
          actions={
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          }
        />

        <FabricaExecutiveKPIs kpis={kpis} isLoading={isLoading} />
        <ChartTabs tabs={tabs} />
      </div>
    </DashboardLayout>
  );
}
