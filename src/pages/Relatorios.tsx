import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileDown, Calendar, Filter } from "lucide-react";
import { RelatorioDesempenho } from "@/components/relatorios/RelatorioDesempenho";
import { RelatorioConcorrentes } from "@/components/relatorios/RelatorioConcorrentes";
import { RelatorioFinanceiro } from "@/components/relatorios/RelatorioFinanceiro";

export default function Relatorios() {
  const [activeTab, setActiveTab] = useState("desempenho");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground mt-1">
              Análises profissionais com exportação em PDF e Excel
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Período
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
            <TabsTrigger value="concorrentes">Concorrentes</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="desempenho" className="space-y-4">
            <RelatorioDesempenho />
          </TabsContent>

          <TabsContent value="concorrentes" className="space-y-4">
            <RelatorioConcorrentes />
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-4">
            <RelatorioFinanceiro />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
