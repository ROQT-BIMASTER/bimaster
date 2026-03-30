import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, CalendarDays, ClipboardList, Link2, Plus, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTradeSupervisorDashboard,
  getDateRangeFromPreset,
  DatePreset,
  DateRangeFilter,
} from "@/hooks/useTradeSupervisorDashboard";
import { TradeExecutiveKPIs } from "@/components/trade/executive/TradeExecutiveKPIs";
import { TradeExecutiveCampaigns } from "@/components/trade/executive/TradeExecutiveCampaigns";
import { TradeExecutiveEvolutionChart } from "@/components/trade/executive/TradeExecutiveEvolutionChart";
import { TradeExecutiveTopClients } from "@/components/trade/executive/TradeExecutiveTopClients";
import { TradeExecutiveVisitsTable } from "@/components/trade/executive/TradeExecutiveVisitsTable";
import { TradeExecutivePhotosGallery } from "@/components/trade/executive/TradeExecutivePhotosGallery";
import { TradeExecutiveLancamentosTable } from "@/components/trade/executive/TradeExecutiveLancamentosTable";
import { TradeExecutiveCurvaChart } from "@/components/trade/executive/TradeExecutiveCurvaChart";
import { SupervisorTeamSelector } from "@/components/trade/supervisor/SupervisorTeamSelector";
import { TeamMemberRegistration } from "@/components/trade/supervisor/TeamMemberRegistration";
import { GenerateFormLinkDialog } from "@/components/trade/supervisor/GenerateFormLinkDialog";
import { FormSubmissionsPanel } from "@/components/trade/supervisor/FormSubmissionsPanel";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const presetLabels: Record<DatePreset, string> = {
  this_month: "Este mês",
  last_30_days: "Últimos 30 dias",
  last_90_days: "Últimos 90 dias",
  this_year: "Este ano",
  custom: "Personalizado",
};

const FORM_ALLOWED_IDS = [
  "7eb17733-d824-4758-8ddf-7b9606ef4991", // Milene Harumi
  "23d470c6-7a46-4643-9a45-ef082fe808e1", // Jessika Marcondes
];

export default function TradeSupervisorDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isGerente, isSupervisor, loading: roleLoading } = useUserRole();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");

  // Fetch current user id once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const canAccessForms = isAdmin || (currentUserId ? FORM_ALLOWED_IDS.includes(currentUserId) : false);
  const [customRange, setCustomRange] = useState<DateRangeFilter | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const dateRange = getDateRangeFromPreset(datePreset, customRange);

  const {
    team,
    teamHierarchy,
    isLoadingTeam,
    kpis,
    campaigns,
    evolution,
    topClients,
    visits,
    photos,
    lancamentos,
    curvaDistribuicao,
    isLoading,
    isLoadingEvolution,
    isLoadingVisits,
    isLoadingPhotos,
    isLoadingLancamentos,
    isLoadingCurva,
    error,
    refetchAll,
  } = useTradeSupervisorDashboard(dateRange, selectedMemberId);

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

  // Guard: only admin, gerente, or supervisor can access this page
  if (!roleLoading && !(isAdmin || isGerente || isSupervisor)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>
              Você não tem permissão para acessar esta tela. Apenas administradores, gerentes e supervisores podem visualizar dados da equipe.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-2">Erro ao carregar dados</p>
            <Button onClick={refetchAll}>Tentar novamente</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const hasTeam = team && team.length > 0;
  const teamMemberIds = (team || []).map((m) => m.id);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div>
          <ModuleBreadcrumb
            moduleName="Trade Marketing"
            moduleHref="/dashboard/trade"
            currentPage="Minha Equipe"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <Users className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                Visão da Equipe
              </h1>
              <p className="text-muted-foreground mt-1">
                Painel consolidado da sua equipe de Trade Marketing
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {activeTab === "dashboard" && (
                <>
                  {/* Team Selector */}
                  <SupervisorTeamSelector
                    team={team || []}
                    teamHierarchy={teamHierarchy}
                    selectedMemberId={selectedMemberId}
                    onSelectMember={setSelectedMemberId}
                    isLoading={isLoadingTeam}
                  />

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
                            selected={
                              customRange ? { from: customRange.from, to: customRange.to } : undefined
                            }
                            onSelect={handleCalendarSelect}
                            numberOfMonths={2}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </>
              )}

              {canAccessForms && <GenerateFormLinkDialog />}
              <Button variant="outline" size="sm" onClick={refetchAll}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>

          {activeTab === "dashboard" && (
            <div className="mt-2 text-sm text-muted-foreground">
              Período: {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} até{" "}
              {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <Users className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="cadastro" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Cadastro Equipe
            </TabsTrigger>
            {canAccessForms && (
              <TabsTrigger value="formularios" className="gap-2">
                <Link2 className="h-4 w-4" />
                Formulários
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab: Dashboard */}
          <TabsContent value="dashboard" className="space-y-6 mt-4">
            {/* Loading State for Team */}
            {isLoadingTeam && (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="grid gap-4 md:grid-cols-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              </div>
            )}

            {!isLoadingTeam && !hasTeam && (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  Você não possui subordinados cadastrados. Entre em contato com o administrador para
                  configurar sua equipe.
                </AlertDescription>
              </Alert>
            )}

            {hasTeam && (
              <>
                <section>
                  <h2 className="text-lg font-semibold mb-4 text-muted-foreground">KPIs da Equipe</h2>
                  <TradeExecutiveKPIs data={kpis} isLoading={isLoading} />
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                    Lançamentos da Equipe
                  </h2>
                  <TradeExecutiveCampaigns data={campaigns} isLoading={isLoading} />
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <TradeExecutiveEvolutionChart data={evolution} isLoading={isLoadingEvolution} />
                  <TradeExecutiveTopClients data={topClients} isLoading={isLoadingEvolution} />
                </section>

                <section>
                  <TradeExecutiveCurvaChart data={curvaDistribuicao} isLoading={isLoadingCurva} />
                </section>

                <section>
                  <TradeExecutiveLancamentosTable
                    data={lancamentos as any}
                    isLoading={isLoadingLancamentos}
                  />
                </section>

                <section>
                  <TradeExecutiveVisitsTable data={visits} isLoading={isLoadingVisits} />
                </section>

                <section>
                  <TradeExecutivePhotosGallery data={photos} isLoading={isLoadingPhotos} />
                </section>
              </>
            )}
          </TabsContent>

          {/* Tab: Cadastro Equipe */}
          <TabsContent value="cadastro" className="mt-4">
            <TeamMemberRegistration
              teamMemberIds={teamMemberIds}
              isLoadingTeam={isLoadingTeam}
            />
          </TabsContent>

          {/* Tab: Formulários - only for Milene, Jessika, and Admins */}
          {canAccessForms && (
            <TabsContent value="formularios" className="mt-4">
              <FormSubmissionsPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
