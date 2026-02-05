import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CreditCard } from "lucide-react";
import { PaymentQueueKPIs } from "@/components/financeiro/payments/PaymentQueueKPIs";
import { PaymentQueueTable } from "@/components/financeiro/payments/PaymentQueueTable";
import { PaymentReviewDialog } from "@/components/financeiro/payments/PaymentReviewDialog";
import { useFinancialPaymentQueue, type PaymentQueueItem, type PaymentQueueStatus, type SourceType } from "@/hooks/useFinancialPaymentQueue";
import { useAllEmpresas } from "@/hooks/useUserEmpresas";
import { supabase } from "@/integrations/supabase/client";

export default function FinancialPaymentCentral() {
  const [filters, setFilters] = useState<{
    status: PaymentQueueStatus | 'all';
    source_type: string; // Can be SourceType, 'all', or 'dept:DepartmentName'
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

  // Fetch empresas for the filter
  const { data: empresas = [] } = useAllEmpresas();

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

  const handleReject = (id: string, notes: string) => {
    updateStatus({ id, financial_status: 'rejected', financial_notes: notes }, {
      onSuccess: () => {
        setReviewDialogOpen(false);
        setSelectedItem(null);
      },
    });
  };

  const handleMarkPaid = (id: string, notes?: string) => {
    updateStatus({ id, financial_status: 'paid', financial_notes: notes }, {
      onSuccess: () => {
        setReviewDialogOpen(false);
        setSelectedItem(null);
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Central de Pagamentos</h1>
              <p className="text-muted-foreground">
                Gerencie solicitações de pagamento de Trade e Eventos
              </p>
            </div>
          </div>
          
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

        {/* Review Dialog */}
        <PaymentReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          item={selectedItem}
          onAccept={handleAccept}
          onReject={handleReject}
          onMarkPaid={handleMarkPaid}
          isProcessing={isAccepting || isUpdating}
        />
      </div>
    </DashboardLayout>
  );
}
