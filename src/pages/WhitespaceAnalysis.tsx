import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { ChevronRight, Compass, Info, ChevronDown, Target, TrendingUp, Map, BarChart3 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { REGIOES, REGIOES_UFS } from "@/lib/constants/regioes";
import { useWhitespaceAnalysis, type WhitespaceRow } from "@/hooks/useWhitespaceAnalysis";
import { WhitespaceKPICards } from "@/components/comercial/whitespace/WhitespaceKPICards";
import { WhitespaceMicroChart } from "@/components/comercial/whitespace/WhitespaceMicroChart";
import { WhitespaceTable } from "@/components/comercial/whitespace/WhitespaceTable";
import { WhitespaceMunicipioSheet } from "@/components/comercial/whitespace/WhitespaceMunicipioSheet";
import Cliente360Drawer from "@/components/financeiro/cliente360/Cliente360Drawer";

const ALL_UFS = Object.values(REGIOES_UFS).flat().sort();

const WhitespaceAnalysis = () => {
  const [selectedRow, setSelectedRow] = useState<WhitespaceRow | null>(null);
  const [cliente360Codigo, setCliente360Codigo] = useState<string | null>(null);

  const {
    filters,
    sort,
    page,
    totalPages,
    pageSize,
    ufsForRegiao,
    kpis,
    kpisLoading,
    kpiDetails,
    tableData,
    tableTotal,
    tableLoading,
    chartData,
    chartLoading,
    updateFilters,
    updateSort,
    setPage,
  } = useWhitespaceAnalysis();

  const availableUFs = filters.regiao ? ufsForRegiao : ALL_UFS;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/dashboard/comercial" className="hover:text-foreground transition-colors">
            Comercial
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Whitespace</span>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Compass className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Análise de Espaço em Branco</h1>
              <p className="text-sm text-muted-foreground">
                Municípios sem presença comercial em microrregiões onde já atuamos — sua rota de expansão mais eficiente
              </p>
            </div>
          </div>
        </div>

        {/* Explicação */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer group w-full">
            <Info className="h-4 w-4" />
            <span>Como funciona esta análise?</span>
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                A <strong>Análise de Espaço em Branco (Whitespace)</strong> identifica municípios onde sua empresa 
                <strong> ainda não possui clientes ativos</strong>, mas que estão em <strong>microrregiões onde já há presença comercial</strong>. 
                Isso significa oportunidades reais de expansão com menor custo logístico, pois já existem rotas e vendedores operando na região.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex gap-2 items-start">
                  <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Score de Expansão</p>
                    <p className="text-xs text-muted-foreground">
                      Combina PIB per Capita × Penetração da microrregião. Quanto maior, mais promissor o município.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                    <Map className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Penetração da Microrregião</p>
                    <p className="text-xs text-muted-foreground">
                      % de municípios da microrregião onde já temos clientes. Alta penetração = vizinhança já atendida.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Clientes Vizinhos</p>
                    <p className="text-xs text-muted-foreground">
                      Quantidade de clientes ativos nos municípios vizinhos da mesma microrregião.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Filtros Inteligentes</p>
                    <p className="text-xs text-muted-foreground">
                      Use Região, UF e Penetração mínima para focar nas oportunidades mais relevantes para sua equipe.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic">
                💡 <strong>Dica:</strong> Clique em qualquer município na tabela para ver detalhes como clientes vizinhos, 
                dados demográficos e o vendedor mais próximo. Use o slider de penetração mínima para encontrar 
                regiões onde já temos forte presença — essas são as expansões mais fáceis.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-muted/50 border">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Região</label>
            <Select
              value={filters.regiao || "all"}
              onValueChange={(v) => {
                updateFilters({ regiao: v === "all" ? null : v, uf: null });
              }}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {REGIOES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">UF</label>
            <Select
              value={filters.uf || "all"}
              onValueChange={(v) => updateFilters({ uf: v === "all" ? null : v })}
            >
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availableUFs.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">
              Penetração mínima: <span className="font-bold text-foreground">{filters.minPenetracao}%</span>
            </label>
            <Slider
              value={[filters.minPenetracao]}
              onValueChange={([v]) => updateFilters({ minPenetracao: v })}
              min={0}
              max={90}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>90%</span>
            </div>
          </div>
        </div>

        <WhitespaceKPICards
          kpis={kpis}
          loading={kpisLoading}
          detailData={kpiDetails ? {
            ufBreakdown: kpiDetails.uf_breakdown,
            topByPib: kpiDetails.top_by_pib,
            topByPop: kpiDetails.top_by_pop,
            topMicros: kpiDetails.top_micros,
          } : undefined}
        />

        {/* Chart */}
        <WhitespaceMicroChart data={chartData} loading={chartLoading} />

        {/* Table */}
        <WhitespaceTable
          data={tableData}
          totalCount={tableTotal}
          loading={tableLoading}
          sort={sort}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          filters={filters}
          onSort={updateSort}
          onPageChange={setPage}
          onRowClick={setSelectedRow}
        />

        {/* Drill-down sheets */}
        <WhitespaceMunicipioSheet
          row={selectedRow}
          open={!!selectedRow}
          onClose={() => setSelectedRow(null)}
          onOpenCliente360={(codigo) => setCliente360Codigo(codigo)}
        />

        <Cliente360Drawer
          clienteCodigo={cliente360Codigo}
          open={!!cliente360Codigo}
          onClose={() => setCliente360Codigo(null)}
        />
      </div>
    </DashboardLayout>
  );
};

export default WhitespaceAnalysis;
