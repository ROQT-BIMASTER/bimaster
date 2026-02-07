import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { ChevronRight, Compass } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { REGIOES, REGIOES_UFS } from "@/lib/constants/regioes";
import { useWhitespaceAnalysis } from "@/hooks/useWhitespaceAnalysis";
import { WhitespaceKPICards } from "@/components/comercial/whitespace/WhitespaceKPICards";
import { WhitespaceMicroChart } from "@/components/comercial/whitespace/WhitespaceMicroChart";
import { WhitespaceTable } from "@/components/comercial/whitespace/WhitespaceTable";

const ALL_UFS = Object.values(REGIOES_UFS).flat().sort();

const WhitespaceAnalysis = () => {
  const {
    filters,
    sort,
    page,
    totalPages,
    pageSize,
    ufsForRegiao,
    kpis,
    kpisLoading,
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

        {/* KPIs */}
        <WhitespaceKPICards kpis={kpis} loading={kpisLoading} />

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
        />
      </div>
    </DashboardLayout>
  );
};

export default WhitespaceAnalysis;
