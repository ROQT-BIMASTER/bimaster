import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import { useCustosConsolidados } from "@/hooks/useCustosConsolidados";
import {
  FILTROS_DEFAULT,
  aplicarFiltros,
  agregarInsumosFornecedores,
  agregarFornecedores,
  distinct,
  type FiltrosConsolidado,
} from "@/lib/fabrica/consolidado-utils";
import { FiltrosConsolidadoBar } from "@/components/fabrica/analises/consolidado/FiltrosConsolidado";
import { TabProdutos } from "@/components/fabrica/analises/consolidado/TabProdutos";
import { TabInsumosFornecedores } from "@/components/fabrica/analises/consolidado/TabInsumosFornecedores";
import { TabFornecedores } from "@/components/fabrica/analises/consolidado/TabFornecedores";
import { TabPadronizacao } from "@/components/fabrica/analises/consolidado/TabPadronizacao";
import { exportToExcel } from "@/lib/excel-utils";
import { formatCurrency } from "@/lib/formatters";

export default function AnalisesCustosConsolidado() {
  const navigate = useNavigate();
  const { data: produtos = [], isLoading } = useCustosConsolidados();
  const [filtros, setFiltros] = useState<FiltrosConsolidado>(FILTROS_DEFAULT);

  const optGrupos = useMemo(() => {
    const map = new Map<string, string>();
    produtos.forEach((p) => {
      const key = p.grupoId ?? "__sem__";
      if (!map.has(key)) map.set(key, p.grupoNome);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [produtos]);

  const optTipos = useMemo(
    () => distinct(produtos.map((p) => (p.produto.tipo || "OFICIAL").toUpperCase())).map((v) => ({ value: v, label: v })),
    [produtos],
  );
  const optMarcas = useMemo(() => distinct(produtos.map((p) => p.produto.marca)).map((v) => ({ value: v, label: v })), [produtos]);
  const optLinhas = useMemo(() => distinct(produtos.map((p) => p.produto.linha)).map((v) => ({ value: v, label: v })), [produtos]);
  const optFornecedores = useMemo(
    () => distinct(produtos.flatMap((p) => p.itens.map((i) => i.fornecedor))).map((v) => ({ value: v, label: v })),
    [produtos],
  );
  const optTiposInsumo = useMemo(
    () => distinct(produtos.flatMap((p) => p.itens.map((i) => i.tipo_insumo))).map((v) => ({ value: v, label: v })),
    [produtos],
  );

  const filtrados = useMemo(() => aplicarFiltros(produtos, filtros), [produtos, filtros]);

  const kpis = useMemo(() => {
    const total = filtrados.reduce((s, p) => s + p.custoFinal, 0);
    const insumos = filtrados.reduce((s, p) => s + p.itens.length, 0);
    const fornecedores = new Set<string>();
    filtrados.forEach((p) => p.itens.forEach((i) => fornecedores.add(i.fornecedor || "—")));
    return {
      produtos: filtrados.length,
      custoTotal: total,
      insumos,
      fornecedores: fornecedores.size,
    };
  }, [filtrados]);

  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    try {
      setExporting(true);
      const produtosSheet = filtrados.map((p) => ({
        Código: p.produto.codigo,
        Descrição: p.produto.nome,
        Grupo: p.grupoNome,
        Tipo: (p.produto.tipo || "OFICIAL").toUpperCase(),
        Marca: p.produto.marca,
        Linha: p.produto.linha,
        "Custo Final": p.custoFinal,
        "Custo Sim01 (grupo)": p.custoFinalSim01,
        "Δ R$": p.custoFinalSim01 != null ? p.custoFinal - p.custoFinalSim01 : null,
        "Δ %": p.custoFinalSim01 ? (p.custoFinal - p.custoFinalSim01) / p.custoFinalSim01 : null,
        "Total Insumos": p.totalInsumos,
        "IPI (R$)": p.ipiTotal,
        "Made In": p.totalNFMadeIn,
        "Mão de obra NF": p.custoMaoObraNF,
        "Mão de obra Serviço": p.custoMaoObraServico,
        "% Markup": p.percentualMarkup,
        "# Itens": p.itens.length,
        Criado: p.produto.created_at,
      }));
      const insumosSheet = agregarInsumosFornecedores(filtrados).map((r) => ({
        "Cód. Insumo": r.insumoCodigo,
        Descrição: r.insumoNome,
        Fornecedor: r.fornecedor,
        Tipo: r.tipoInsumo,
        "# Produtos": r.nProdutos,
        "Custo Médio": r.custoMedio,
        Mínimo: r.custoMin,
        Máximo: r.custoMax,
        "Variação %": r.variacao,
        "Total Acumulado": r.totalAcumulado,
        "Última NF": r.ultimaNF,
      }));
      const fornecedoresSheet = agregarFornecedores(filtrados).map((r) => ({
        Fornecedor: r.fornecedor,
        "# Produtos": r.nProdutos,
        "# Insumos": r.nInsumos,
        "Total Movimentado": r.totalMovimentado,
        "Ticket Médio": r.ticketMedio,
        "Δ % Médio": r.deltaPctMedio,
      }));
      await exportToExcel(
        [
          { name: "Produtos", data: produtosSheet },
          { name: "Insumos_Fornecedores", data: insumosSheet },
          { name: "Fornecedores", data: fornecedoresSheet },
        ],
        `analises_custos_consolidado_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("Planilha exportada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica/produtos-acabados")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Análises de Custos · Consolidado
              </h1>
              <p className="text-xs text-muted-foreground">
                Todos os produtos da Fábrica, com filtros para investigar custo, insumo e fornecedor.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || filtrados.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <>
            <FiltrosConsolidadoBar
              filtros={filtros}
              setFiltros={setFiltros}
              grupos={optGrupos}
              tipos={optTipos}
              marcas={optMarcas}
              linhas={optLinhas}
              fornecedores={optFornecedores}
              tiposInsumo={optTiposInsumo}
              totalGeral={produtos.length}
              totalFiltrado={filtrados.length}
            />

            <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              <Kpi label="Produtos" value={kpis.produtos} />
              <Kpi label="Custo total filtrado" value={formatCurrency(kpis.custoTotal)} />
              <Kpi label="Linhas de insumo" value={kpis.insumos} />
              <Kpi label="Fornecedores" value={kpis.fornecedores} />
            </div>

            <Tabs defaultValue="produtos" className="space-y-3">
              <TabsList>
                <TabsTrigger value="produtos">Produtos</TabsTrigger>
                <TabsTrigger value="insumos">Insumos × Fornecedores</TabsTrigger>
                <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
                <TabsTrigger value="padronizacao">Padronização</TabsTrigger>
              </TabsList>
              <TabsContent value="produtos">
                <TabProdutos produtos={filtrados} />
              </TabsContent>
              <TabsContent value="insumos">
                <TabInsumosFornecedores produtos={filtrados} />
              </TabsContent>
              <TabsContent value="fornecedores">
                <TabFornecedores produtos={filtrados} />
              </TabsContent>
              <TabsContent value="padronizacao">
                <TabPadronizacao produtos={filtrados} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
