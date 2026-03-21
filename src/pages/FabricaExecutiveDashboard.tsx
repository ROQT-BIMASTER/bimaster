import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, Factory } from "lucide-react";
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
import { TrendingUp, BarChart3, AlertTriangle, Layers } from "lucide-react";

export default function FabricaExecutiveDashboard() {
  const { kpis, evolucao, produtosPorMargem, alertas, categorias, custosMP, isLoading, refetch } = useFabricaExecutiveDashboard();

  const tabs = [
    { key: "evolucao", label: "Evolução", icon: <TrendingUp className="h-3.5 w-3.5" />, content: <FabricaEvolutionChart evolucao={evolucao} /> },
    { key: "margens", label: "Margens", icon: <BarChart3 className="h-3.5 w-3.5" />, content: <div className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2"><FabricaTopMargens melhores={produtosPorMargem.melhores} piores={produtosPorMargem.piores} /></div><div><FabricaAlertasPanel alertas={alertas} /></div></div> },
    { key: "categorias", label: "Categorias & MPs", icon: <Layers className="h-3.5 w-3.5" />, content: <div className="grid gap-6 lg:grid-cols-2"><FabricaCategoriasChart categorias={categorias} /><FabricaCustosMPTable materiasPrimas={custosMP} /></div> },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><Factory className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold">Visão Executiva - Fábrica</h1></div>
            <p className="text-muted-foreground mt-1">Análise consolidada de custos, margens e produção</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />Atualizar</Button>
          </div>
        </div>

        <FabricaExecutiveKPIs kpis={kpis} isLoading={isLoading} />
        <ChartTabs tabs={tabs} />
      </div>
    </DashboardLayout>
  );
}
