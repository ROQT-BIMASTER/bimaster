import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Plus, CheckCircle, RefreshCw, LayoutDashboard, CalendarDays, Building2 } from "lucide-react";
import { useDepartmentById } from "@/hooks/useUserDepartments";
import { useDepartmentDashboard, getDateRangeFromPreset, DatePreset, DateRangeFilter } from "@/hooks/useDepartmentDashboard";
import { DeptVerbaCard } from "@/components/departments/dashboard/DeptVerbaCard";
import { DeptDespesasCard } from "@/components/departments/dashboard/DeptDespesasCard";
import { DeptFluxoCaixaChart } from "@/components/departments/dashboard/DeptFluxoCaixaChart";
import { DeptDespesasTable } from "@/components/departments/dashboard/DeptDespesasTable";
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

export default function DepartmentDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [datePreset, setDatePreset] = useState<DatePreset>("this_year");
  const [customRange, setCustomRange] = useState<DateRangeFilter | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateRange = getDateRangeFromPreset(datePreset, customRange);

  const { data: department, isLoading: loadingDept } = useDepartmentById(id || "");

  const {
    verbas,
    verbaMetrics,
    despesaMetrics,
    fluxoCaixa,
    despesasPorCategoria,
    despesas,
    isLoading: loadingData,
    error,
  } = useDepartmentDashboard(id || "", dateRange);

  const isLoading = loadingDept || loadingData;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['department-dashboard-verbas'] });
    queryClient.invalidateQueries({ queryKey: ['department-dashboard-despesas'] });
    queryClient.invalidateQueries({ queryKey: ['department'] });
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

  if (!loadingDept && !department) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Departamento não encontrado</h3>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/dashboard/departamentos")}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Formatar verbas para o componente (calcular available_amount)
  const verbasFormatadas = verbas.map((v: any) => ({
    ...v,
    available_amount: (parseFloat(String(v.total_amount)) || 0) - (parseFloat(String(v.spent_amount)) || 0),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <ModuleBreadcrumb
            moduleName={department?.nome || "Departamento"}
            moduleHref={`/dashboard/departamentos/${id}`}
            currentPage="Dashboard Financeiro"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <LayoutDashboard className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                Dashboard Financeiro {department?.nome}
              </h1>
              <p className="text-muted-foreground mt-1">
                Visão consolidada de verbas e despesas
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
              
              {department?.isManager && (
                <Link to={`/dashboard/departamentos/${id}/aprovacoes`}>
                  <Button variant="outline" size="sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprovações
                  </Button>
                </Link>
              )}
              
              <Link to={`/dashboard/departamentos/${id}/despesas/nova`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Despesa
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
              <DeptVerbaCard 
                metrics={verbaMetrics} 
                verbas={verbasFormatadas} 
                departmentId={id || ""}
              />
              <DeptDespesasCard 
                metrics={despesaMetrics} 
                despesasPorCategoria={despesasPorCategoria} 
                departmentId={id || ""}
              />
            </div>
          )}
        </div>

        {/* Gráfico de Fluxo de Caixa */}
        <div>
          {isLoading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <DeptFluxoCaixaChart 
              data={fluxoCaixa} 
              departmentName={department?.nome || "Departamento"} 
            />
          )}
        </div>

        {/* Tabela de Despesas */}
        {isLoading ? (
          <Skeleton className="h-[500px]" />
        ) : (
          <DeptDespesasTable 
            despesas={despesas} 
            departmentName={department?.nome || "Departamento"} 
          />
        )}
      </div>
    </DashboardLayout>
  );
}
