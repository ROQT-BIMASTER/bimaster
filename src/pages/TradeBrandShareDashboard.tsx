import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, RefreshCcw, BarChart3 } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useBrandShareDashboard } from "@/hooks/useBrandShareDashboard";
import { BrandShareKPIs } from "@/components/trade/brand-share/BrandShareKPIs";
import { BrandSharePieChart } from "@/components/trade/brand-share/BrandSharePieChart";
import { BrandShareEvolutionChart } from "@/components/trade/brand-share/BrandShareEvolutionChart";
import { BrandShareRankingTable } from "@/components/trade/brand-share/BrandShareRankingTable";

type DatePreset = "thisMonth" | "last30" | "last90" | "thisYear" | "custom";

export default function TradeBrandShareDashboard() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last90");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 90),
    to: new Date(),
  });

  const getDateRange = () => {
    const now = new Date();
    switch (datePreset) {
      case "thisMonth":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "last30":
        return { from: subDays(now, 30), to: now };
      case "last90":
        return { from: subDays(now, 90), to: now };
      case "thisYear":
        return { from: new Date(now.getFullYear(), 0, 1), to: now };
      case "custom":
        return customDateRange;
      default:
        return { from: subDays(now, 90), to: now };
    }
  };

  const dateRange = getDateRange();

  const {
    kpis,
    brandDistribution,
    monthlyEvolution,
    brandNames,
    storeRanking,
    isLoading,
    refetch,
    brandColors,
  } = useBrandShareDashboard(dateRange.from, dateRange.to);

  const presetButtons: { key: DatePreset; label: string }[] = [
    { key: "thisMonth", label: "Este Mês" },
    { key: "last30", label: "30 dias" },
    { key: "last90", label: "90 dias" },
    { key: "thisYear", label: "Este Ano" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Trade Marketing"
          moduleHref="/dashboard/trade"
          currentPage="Dashboard de Marcas"
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Dashboard de Share por Marca</h1>
              <p className="text-muted-foreground">
                Análise de participação das marcas nas prateleiras
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCcw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {presetButtons.map((preset) => (
            <Button
              key={preset.key}
              variant={datePreset === preset.key ? "default" : "outline"}
              size="sm"
              onClick={() => setDatePreset(preset.key)}
            >
              {preset.label}
            </Button>
          ))}

          {datePreset === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="ml-2">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                  {format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setCustomDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  locale={ptBR}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* KPIs */}
        <BrandShareKPIs
          totalMeasurements={kpis.totalMeasurements}
          avgShare={kpis.avgShare}
          leadingBrand={kpis.leadingBrand}
          growth={kpis.growth}
        />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BrandSharePieChart data={brandDistribution} />
          <BrandShareEvolutionChart
            data={monthlyEvolution}
            brandNames={brandNames}
            brandColors={brandColors}
          />
        </div>

        {/* Ranking Table */}
        <BrandShareRankingTable data={storeRanking} />
      </div>
    </DashboardLayout>
  );
}
