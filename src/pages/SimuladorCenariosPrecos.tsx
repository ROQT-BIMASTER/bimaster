import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Save, FileSpreadsheet, ArrowRight, RefreshCw } from "lucide-react";
import { SimuladorCenarioConfig } from "@/components/simulador/SimuladorCenarioConfig";
import { SimuladorComparativo } from "@/components/simulador/SimuladorComparativo";
import { SimuladorGraficos } from "@/components/simulador/SimuladorGraficos";
import { SimuladorCadeiaImpacto } from "@/components/simulador/SimuladorCadeiaImpacto";
import { SimuladorProdutoSelector } from "@/components/simulador/SimuladorProdutoSelector";
import { useSimuladorPrecos } from "@/hooks/useSimuladorPrecos";

export default function SimuladorCenariosPrecos() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("configuracao");
  
  const {
    cenarioBase,
    setCenarioBase,
    cenarioSimulacao,
    setCenarioSimulacao,
    produtosSelecionados,
    setProdutosSelecionados,
    resultados,
    impactoCadeia,
    isLoading,
    recalcular,
    salvarCenario,
    exportarExcel,
  } = useSimuladorPrecos();

  const handleSalvar = async () => {
    try {
      await salvarCenario();
      toast({
        title: "Cenário salvo",
        description: "O cenário foi salvo com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o cenário.",
        variant: "destructive",
      });
    }
  };

  const handleExportar = () => {
    exportarExcel();
    toast({
      title: "Exportação iniciada",
      description: "O arquivo Excel está sendo gerado.",
    });
  };

  const temResultados = resultados.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <ModuleBreadcrumb
            moduleName="Tabelas de Preços"
            moduleHref="/dashboard/precos"
            currentPage="Simulador de Cenários"
          />
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FlaskConical className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Simulador de Cenários de Preços</h1>
                <p className="text-muted-foreground">
                  Teste diferentes configurações de markup antes de criar tabelas reais
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => recalcular()}
                disabled={isLoading || !cenarioSimulacao}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Recalcular
              </Button>
              <Button
                variant="outline"
                onClick={handleExportar}
                disabled={!temResultados}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={!temResultados}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Cenário
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="configuracao">Configuração</TabsTrigger>
            <TabsTrigger value="comparativo" disabled={!temResultados}>Comparativo</TabsTrigger>
            <TabsTrigger value="graficos" disabled={!temResultados}>Gráficos</TabsTrigger>
            <TabsTrigger value="cadeia" disabled={!temResultados}>Cadeia de Impacto</TabsTrigger>
          </TabsList>

          <TabsContent value="configuracao" className="space-y-6">
            {/* Configuração de Cenários */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SimuladorCenarioConfig
                titulo="Cenário Base (Referência)"
                cenario={cenarioBase}
                onChange={setCenarioBase}
                isBase
              />
              <SimuladorCenarioConfig
                titulo="Cenário de Simulação"
                cenario={cenarioSimulacao}
                onChange={setCenarioSimulacao}
              />
            </div>

            {/* Seletor de Produtos */}
            <SimuladorProdutoSelector
              produtosSelecionados={produtosSelecionados}
              onChange={setProdutosSelecionados}
              origem={cenarioSimulacao?.origem}
            />

            {/* Botão de Simular */}
            {cenarioSimulacao && produtosSelecionados.length > 0 && (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center py-8">
                  <Button
                    size="lg"
                    onClick={() => {
                      recalcular();
                      setActiveTab("comparativo");
                    }}
                    disabled={isLoading}
                  >
                    <FlaskConical className="h-5 w-5 mr-2" />
                    Simular Preços
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="comparativo">
            <SimuladorComparativo
              resultados={resultados}
              cenarioBase={cenarioBase}
              cenarioSimulacao={cenarioSimulacao}
            />
          </TabsContent>

          <TabsContent value="graficos">
            <SimuladorGraficos resultados={resultados} />
          </TabsContent>

          <TabsContent value="cadeia">
            <SimuladorCadeiaImpacto
              impacto={impactoCadeia}
              tabelaSimulada={cenarioSimulacao?.tabela_base_id || ''}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
