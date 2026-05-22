import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Download, LayoutGrid } from "lucide-react";
import { useGrupoCenario } from "@/hooks/useGrupoCenarios";
import { useCenariosCustosCompletos } from "@/hooks/useCenariosCustosCompletos";
import { ComparativoSimulacoes } from "@/components/fabrica/analises/ComparativoSimulacoes";
import { ConsolidadoComposicao } from "@/components/fabrica/analises/ConsolidadoComposicao";
import { ProvadoresVsPai } from "@/components/fabrica/analises/ProvadoresVsPai";
import { exportAnalisesCustos } from "@/lib/fabrica/export-analises-custos";
import { toast } from "sonner";

export default function AnalisesCustos() {
  const { grupoId } = useParams<{ grupoId: string }>();
  const navigate = useNavigate();
  const { data: cenarios = [], isLoading: loadingCen } = useGrupoCenario(grupoId ?? null, false);
  const { data: custosArr = [], isLoading: loadingCustos } = useCenariosCustosCompletos(cenarios);

  const isLoading = loadingCen || loadingCustos;
  const grupoLabel = cenarios[0]?.nome ?? "Grupo";

  const ids = useMemo(() => cenarios.map((c) => c.id), [cenarios]);

  const { data: provadores = [] } = useQuery({
    queryKey: ["fabrica-provadores-export", ids.slice().sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_fabrica_provadores_custo" as any)
        .select("provador_codigo, provador_nome, pai_codigo, pai_nome, custo_fabrica, custo_pai, pct_do_pai")
        .or(`provador_id.in.(${ids.join(",")}),pai_id.in.(${ids.join(",")})`);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        provador_codigo: r.provador_codigo || "",
        provador_nome: r.provador_nome || "",
        pai_codigo: r.pai_codigo || "",
        pai_nome: r.pai_nome || "",
        custo_fabrica: Number(r.custo_fabrica || 0),
        custo_pai: Number(r.custo_pai || 0),
        pct_do_pai: Number(r.pct_do_pai || 0),
      }));
    },
  });

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    try {
      setExporting(true);
      await exportAnalisesCustos({ custosArr, provadores, grupoLabel });
      toast.success("Planilha exportada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => grupoId
                ? navigate(`/dashboard/fabrica/cenarios/${grupoId}`)
                : navigate("/dashboard/fabrica/produtos-acabados")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Análises de Custos
              </h1>
              <p className="text-xs text-muted-foreground">
                {cenarios.length} cenário(s) · {grupoLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard/fabrica/analises-custos")}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Visão Consolidada
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || custosArr.length === 0}>
              <Download className="h-4 w-4 mr-1.5" />
              {exporting ? "Exportando..." : "Exportar Excel"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-96" />
          </div>
        ) : cenarios.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum cenário neste grupo.
          </Card>
        ) : (
          <Tabs defaultValue="comparativo" className="space-y-3">
            <TabsList>
              <TabsTrigger value="comparativo">Comparativo Sim01 × Sim02</TabsTrigger>
              <TabsTrigger value="consolidado">Consolidado de Composição</TabsTrigger>
              <TabsTrigger value="provadores">Provadores × Pai</TabsTrigger>
            </TabsList>
            <TabsContent value="comparativo">
              <ComparativoSimulacoes custosArr={custosArr} />
            </TabsContent>
            <TabsContent value="consolidado">
              <ConsolidadoComposicao custosArr={custosArr} />
            </TabsContent>
            <TabsContent value="provadores">
              <ProvadoresVsPai custosArr={custosArr} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
