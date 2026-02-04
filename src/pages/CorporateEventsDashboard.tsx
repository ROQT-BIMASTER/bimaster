import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Plus, CheckCircle, RefreshCw, LayoutDashboard, CalendarDays } from "lucide-react";
import { useEventsDashboard, getDateRangeFromPreset, DatePreset, DateRangeFilter } from "@/hooks/useEventsDashboard";
import { EventsVerbaCard } from "@/components/events/dashboard/EventsVerbaCard";
import { EventsDespesasCard } from "@/components/events/dashboard/EventsDespesasCard";
import { EventsFluxoCaixaChart } from "@/components/events/dashboard/EventsFluxoCaixaChart";
import { EventsDespesasTable } from "@/components/events/dashboard/EventsDespesasTable";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

const presetLabels: Record<DatePreset, string> = {
  this_month: "Este mês",
  last_30_days: "Últimos 30 dias",
  last_90_days: "Últimos 90 dias",
  this_year: "Este ano",
  custom: "Personalizado",
};

export default function CorporateEventsDashboard() {
  const queryClient = useQueryClient();
  const [datePreset, setDatePreset] = useState<DatePreset>("this_year");
  const [customRange, setCustomRange] = useState<DateRangeFilter | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateRange = getDateRangeFromPreset(datePreset, customRange);

  const {
    verbas,
    verbaMetrics,
    eventoMetrics,
    fluxoCaixa,
    despesasPorEvento,
    despesas,
    isLoading,
    error,
  } = useEventsDashboard(dateRange);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['events-dashboard-verbas'] });
    queryClient.invalidateQueries({ queryKey: ['events-dashboard-eventos'] });
    queryClient.invalidateQueries({ queryKey: ['events-dashboard-despesas'] });
  };

  const handlePresetChange = (value: string) => {
    const preset = value as DatePreset;
    setDatePreset(preset);
    if (preset === "custom") {
      setCalendarOpen(true);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setCustomRange({ from: range.from, to: range.to });
      setCalendarOpen(false);
    } else if (range?.from) {
      setCustomRange({ from: range.from, to: range.from });
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-2">Erro ao carregar dados</p>
            <Button onClick={handleRefresh}>Tentar novamente</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <ModuleBreadcrumb
            moduleName="Eventos Corporativos"
            moduleHref="/dashboard/eventos"
            currentPage="Dashboard Financeiro"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <LayoutDashboard className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                Dashboard Financeiro Eventos
              </h1>
              <p className="text-muted-foreground mt-1">
                Visão consolidada de verbas, eventos e despesas
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <Select value={datePreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-[180px]">
                    <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(presetLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {datePreset === "custom" && (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs">
                        {customRange
                          ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}`
                          : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={customRange?.from}
                        selected={customRange ? { from: customRange.from, to: customRange.to } : undefined}
                        onSelect={handleCalendarSelect}
                        numberOfMonths={2}
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Link to="/dashboard/eventos/aprovacoes">
                <Button variant="outline" size="sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprovações
                </Button>
              </Link>
              <Link to="/dashboard/eventos">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Evento
                </Button>
              </Link>
            </div>
          </div>

          {/* Date Range Indicator */}
          <div className="mt-2 text-sm text-muted-foreground">
            Período: {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} até {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </div>

        {/* Cards de KPIs */}
        <div>
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-[350px]" />
              <Skeleton className="h-[350px]" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <EventsVerbaCard 
                metrics={verbaMetrics} 
                verbas={verbas as any[]} 
              />
              <EventsDespesasCard 
                metrics={eventoMetrics} 
                despesasPorEvento={despesasPorEvento} 
              />
            </div>
          )}
        </div>

        {/* Gráfico de Fluxo de Caixa */}
        <div>
          {isLoading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <EventsFluxoCaixaChart data={fluxoCaixa} />
          )}
        </div>

        {/* Tabela de Despesas */}
        {isLoading ? (
          <Skeleton className="h-[500px]" />
        ) : (
          <EventsDespesasTable despesas={despesas} />
        )}
      </div>
    </DashboardLayout>
  );
}
