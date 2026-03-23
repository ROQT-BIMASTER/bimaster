import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CreditCard, ArrowLeft, Download, Loader2, LayoutDashboard, CalendarDays, Settings2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PaymentChatConsolidado } from "@/components/financeiro/payments/PaymentChatConsolidado";
import { useAllPaymentConversations } from "@/hooks/usePaymentMessages";
import { PaymentPolicyConfigDialog } from "@/components/financeiro/payments/PaymentPolicyConfigDialog";
import { PaymentPolicyBanner } from "@/components/financeiro/payments/PaymentPolicyBanner";
import { PaymentQueueKPIs } from "@/components/financeiro/payments/PaymentQueueKPIs";
import { PaymentQueueTable } from "@/components/financeiro/payments/PaymentQueueTable";
import { PaymentReviewDialog } from "@/components/financeiro/payments/PaymentReviewDialog";
import { useFinancialPaymentQueue, type PaymentQueueItem, type PaymentQueueStatus, type SourceType } from "@/hooks/useFinancialPaymentQueue";
import { useAllEmpresas } from "@/hooks/useUserEmpresas";
import { useEmpresaFilter } from "@/hooks/useEmpresaFilter";
import { supabase } from "@/integrations/supabase/client";
import { exportPaymentQueueToExcel } from "@/lib/exportExpenses";
import { toast } from "sonner";

// Consolidated dashboard imports
import {
  useFinanceiroConsolidadoDashboard,
  getDateRangeFromPreset,
  type DatePreset,
  type DateRangeFilter,
} from "@/hooks/useFinanceiroConsolidadoDashboard";
import { ConsolidadoVerbaCard } from "@/components/financeiro/consolidado/ConsolidadoVerbaCard";
import { ConsolidadoDespesasCard } from "@/components/financeiro/consolidado/ConsolidadoDespesasCard";
import { ConsolidadoFluxoCaixaChart } from "@/components/financeiro/consolidado/ConsolidadoFluxoCaixaChart";
import { ConsolidadoDespesasTable } from "@/components/financeiro/consolidado/ConsolidadoDespesasTable";
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

function UnreadChatBadge() {
  const { data: conversations } = useAllPaymentConversations();
  const totalUnread = conversations?.reduce((sum, c) => sum + (c.unread || 0), 0) || 0;
  if (totalUnread === 0) return null;
  return (
    <Badge variant="destructive" className="text-[10px] h-4 min-w-[16px] px-1 justify-center ml-1" style={{ animation: "blink-unread 1.2s ease-in-out infinite" }}>
      {totalUnread}
    </Badge>
  );
}

export default function FinancialPaymentCentral() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<{
    status: PaymentQueueStatus | 'all';
    source_type: string;
    empresa_id: number | 'all';
    search: string;
  }>({
    status: 'all',
    source_type: 'all',
    empresa_id: 'all',
    search: '',
  });

  const [selectedItem, setSelectedItem] = useState<PaymentQueueItem | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [policyConfigOpen, setPolicyConfigOpen] = useState(false);

  // Item 13: Export confirmation
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);

  // Item 9: Reopen justification
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenJustificativa, setReopenJustificativa] = useState("");
  const [reopenItemId, setReopenItemId] = useState<string | null>(null);

  // Consolidated dashboard state
  const [datePreset, setDatePreset] = useState<DatePreset>("this_year");
  const [customRange, setCustomRange] = useState<DateRangeFilter | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateRange = getDateRangeFromPreset(datePreset, customRange);

  // Fetch departments for the filter
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch empresas for the filter — scoped to user's accessible empresas
  const { empresasDoUsuario: empresas } = useEmpresaFilter();

  const { 
    items, 
    kpis, 
    isLoading, 
    refetch,
    acceptPayment,
    updateStatus,
    isAccepting,
    isUpdating,
  } = useFinancialPaymentQueue({
    status: filters.status,
    source_type: filters.source_type,
    empresa_id: filters.empresa_id,
    search: filters.search,
  });

  // Consolidated dashboard data
  const consolidado = useFinanceiroConsolidadoDashboard(dateRange);

  const handleReview = (item: PaymentQueueItem) => {
    setSelectedItem(item);
    setReviewDialogOpen(true);
  };

  const handleAccept = (id: string, notes?: string) => {
    acceptPayment({ id, financial_notes: notes }, {
      onSuccess: () => {
        setReviewDialogOpen(false);
        setSelectedItem(null);
      },
    });
  };

  const handleReject = (id: string, notes: string, rejectionCategory?: string, rejectionFields?: string[]) => {
    updateStatus({ id, financial_status: 'rejected', financial_notes: notes, rejection_category: rejectionCategory, rejection_fields: rejectionFields }, {
      onSuccess: () => {
        setReviewDialogOpen(false);
        setSelectedItem(null);
      },
    });
  };

  const handleMarkPaid = (id: string, paymentMethod: string, paymentDetails: Record<string, string>, notes?: string) => {
    updateStatus({ id, financial_status: 'paid', financial_notes: notes, payment_method: paymentMethod, payment_details: paymentDetails }, {
      onSuccess: () => {
        setReviewDialogOpen(false);
        setSelectedItem(null);
      },
    });
  };

  // Item 9: Reopen with mandatory justification
  const handleReopen = (id: string) => {
    setReopenItemId(id);
    setReopenJustificativa("");
    setReopenDialogOpen(true);
  };

  const handleConfirmReopen = () => {
    if (!reopenItemId || !reopenJustificativa.trim()) return;
    updateStatus({ id: reopenItemId, financial_status: 'pending', financial_notes: `Reaberto para reanálise: ${reopenJustificativa.trim()}` }, {
      onSuccess: () => {
        setReviewDialogOpen(false);
        setSelectedItem(null);
        setReopenDialogOpen(false);
        setReopenItemId(null);
        toast.success("Solicitação reaberta para reanálise");
      },
    });
  };

  // Item 13: Export with confirmation
  const handleExportClick = () => {
    if (items.length > 100) {
      setExportConfirmOpen(true);
    } else {
      doExport();
    }
  };

  const doExport = async () => {
    setIsExporting(true);
    setExportConfirmOpen(false);
    try {
      await exportPaymentQueueToExcel(items, "central-pagamentos");
      toast.success("Exportação concluída com sucesso!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePresetChange = (value: string) => {
    const preset = value as DatePreset;
    setDatePreset(preset);
    if (preset === "custom") setCalendarOpen(true);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setCustomRange({ from: range.from, to: range.to });
      setCalendarOpen(false);
    } else if (range?.from) {
      setCustomRange({ from: range.from, to: range.from });
    }
  };

  const handleConsolidadoRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["consolidado-trade-budgets"] });
    queryClient.invalidateQueries({ queryKey: ["consolidado-dept-budgets"] });
    queryClient.invalidateQueries({ queryKey: ["consolidado-trade-despesas"] });
    queryClient.invalidateQueries({ queryKey: ["consolidado-eventos-despesas"] });
    queryClient.invalidateQueries({ queryKey: ["consolidado-dept-despesas"] });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="p-2.5 rounded-xl bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Central de Pagamentos</h1>
              <p className="text-muted-foreground">
                Gerencie solicitações de pagamento de Trade, Eventos e Departamentos
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="fila" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="fila" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Fila de Pagamentos
            </TabsTrigger>
            <TabsTrigger value="consolidado" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="comunicacao" className="gap-2 relative">
              <MessageSquare className="h-4 w-4" />
              Comunicação
              <UnreadChatBadge />
            </TabsTrigger>
          </TabsList>

          {/* Tab: Fila de Pagamentos */}
          <TabsContent value="fila" className="space-y-6">
          {/* Payment Policy Banner */}
          <PaymentPolicyBanner />

          <div className="flex justify-end gap-2">
              <Button 
                variant="outline"
                onClick={() => setPolicyConfigOpen(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Política de Pagamento
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportClick}
                disabled={isExporting || items.length === 0}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Exportar Excel
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            {/* KPIs */}
            <PaymentQueueKPIs kpis={kpis} />

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Solicitações de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentQueueTable
                  items={items}
                  isLoading={isLoading}
                  onReview={handleReview}
                  departments={departments}
                  empresas={empresas}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Dashboard Consolidado */}
          <TabsContent value="consolidado" className="space-y-6">
            {/* Filtros e ações do consolidado */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Período: {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} até{" "}
                {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
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

                <Button variant="outline" size="sm" onClick={handleConsolidadoRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Cards de KPIs */}
            {consolidado.isLoading ? (
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-[350px]" />
                <Skeleton className="h-[350px]" />
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <ConsolidadoVerbaCard metrics={consolidado.verbaMetrics} verbas={consolidado.verbasConsolidadas} />
                <ConsolidadoDespesasCard metrics={consolidado.despesaMetrics} despesasPorOrigem={consolidado.despesasPorOrigem} />
              </div>
            )}

            {/* Gráfico de Fluxo de Caixa */}
            {consolidado.isLoading ? (
              <Skeleton className="h-[400px]" />
            ) : (
              <ConsolidadoFluxoCaixaChart data={consolidado.fluxoCaixa} />
            )}

            {/* Tabela de Despesas */}
            {consolidado.isLoading ? (
              <Skeleton className="h-[500px]" />
            ) : (
              <ConsolidadoDespesasTable despesas={consolidado.despesas} />
            )}
          </TabsContent>

          {/* Tab: Comunicação */}
          <TabsContent value="comunicacao">
            <PaymentChatConsolidado />
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <PaymentReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          item={selectedItem}
          onAccept={handleAccept}
          onReject={handleReject}
          onMarkPaid={handleMarkPaid}
          onReopen={handleReopen}
          isProcessing={isAccepting || isUpdating}
          onRefresh={refetch}
        />
        {/* Policy Config Dialog */}
        <PaymentPolicyConfigDialog
          open={policyConfigOpen}
          onOpenChange={setPolicyConfigOpen}
        />

        {/* Item 9: Reopen justification dialog */}
        <AlertDialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reabrir para Reanálise</AlertDialogTitle>
              <AlertDialogDescription>
                Informe a justificativa para reabrir esta solicitação. Este registro será salvo no histórico de auditoria.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label htmlFor="reopen-justificativa" className="text-sm font-medium">
                Justificativa <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reopen-justificativa"
                placeholder="Descreva o motivo da reabertura..."
                value={reopenJustificativa}
                onChange={(e) => setReopenJustificativa(e.target.value)}
                rows={3}
                className="mt-1.5"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmReopen}
                disabled={!reopenJustificativa.trim()}
              >
                Confirmar Reabertura
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Item 13: Export confirmation dialog */}
        <AlertDialog open={exportConfirmOpen} onOpenChange={setExportConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Exportar para Excel</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a exportar <strong>{items.length} registros</strong>. Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={doExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar {items.length} registros
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
