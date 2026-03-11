import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchAllRows } from "@/lib/utils/fetchAllRows";
import { exportPaymentToErp } from "@/hooks/useErpExport";

export type PaymentQueueStatus = 'pending' | 'accepted' | 'rejected' | 'paid' | 'cancelled';
export type SourceType = 'trade_entry' | 'trade_investment' | 'trade_campaign' | 'event_expense' | 'department_expense';

export interface PaymentAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export interface PaymentQueueItem {
  id: string;
  code: string;
  source_type: SourceType;
  source_id: string;
  source_code: string | null;
  supplier_name: string;
  supplier_document: string | null;
  document_type: string | null;
  document_number: string | null;
  amount: number;
  due_date: string;
  portador: string | null;
  description: string | null;
  notes: string | null;
  attachment_url: string | null;
  attachments: PaymentAttachment[];
  department_name: string | null;
  requested_by: string | null;
  requested_at: string;
  financial_status: PaymentQueueStatus;
  financial_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  contas_pagar_id: string | null;
  receipt_url: string | null;
  receipt_sent_at: string | null;
  payment_method: string | null;
  payment_details: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  // Multi-filial fields
  empresa_id: number | null;
  empresa_nome: string | null;
  // Joined data
  requester_name?: string;
  reviewer_name?: string;
}

interface CreatePaymentQueueInput {
  source_type: SourceType;
  source_id: string;
  source_code?: string;
  supplier_name: string;
  supplier_document?: string;
  document_type?: string;
  document_number?: string;
  amount: number;
  due_date: string;
  portador?: string;
  description?: string;
  notes?: string;
  attachment_url?: string;
  department_name?: string;
  empresa_id?: number;
  empresa_nome?: string;
}

interface UpdatePaymentStatusInput {
  id: string;
  financial_status: PaymentQueueStatus;
  financial_notes?: string;
  payment_method?: string;
  payment_details?: Record<string, string>;
  rejection_category?: string;
  rejection_fields?: string[];
}

interface PaymentQueueFilters {
  status?: PaymentQueueStatus | 'all';
  source_type?: string; // Can be SourceType, 'all', or 'dept:DepartmentName'
  empresa_id?: number | 'all'; // Filter by empresa
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

// Helper to sync financial status back to the original source expense
async function syncStatusToSource(item: { source_type: string; source_id: string; financial_status: string }) {
  const now = new Date().toISOString();
  try {
    if (item.source_type === 'event_expense') {
      const statusMap: Record<string, string> = {
        accepted: 'approved',
        paid: 'paid',
        rejected: 'rejected',
        cancelled: 'cancelled',
        pending: 'pending',
      };
      const newStatus = statusMap[item.financial_status];
      if (!newStatus) return;

      const updateData: Record<string, unknown> = { status: newStatus };
      if (item.financial_status === 'paid') {
        updateData.paid_at = now;
      }

      await supabase
        .from('corporate_event_expenses')
        .update(updateData)
        .eq('id', item.source_id);
    } else if (item.source_type === 'department_expense') {
      const statusMap: Record<string, string> = {
        accepted: 'approved',
        paid: 'paid',
        rejected: 'rejected',
        cancelled: 'cancelled',
        pending: 'pending',
      };
      const newStatus = statusMap[item.financial_status];
      if (!newStatus) return;

      const updateData: Record<string, unknown> = { status: newStatus };
      if (item.financial_status === 'paid') {
        updateData.paid_at = now;
      }

      await supabase
        .from('department_expenses')
        .update(updateData)
        .eq('id', item.source_id);
    } else if (item.source_type === 'trade_entry') {
      const statusMap: Record<string, string> = {
        accepted: 'pending_financial',
        paid: 'paid',
        rejected: 'rejected',
        cancelled: 'cancelled',
        pending: 'pending',
      };
      const newStatus = statusMap[item.financial_status];
      if (!newStatus) return;

      const updateData: Record<string, unknown> = { status: newStatus };
      if (item.financial_status === 'paid') {
        updateData.paid_at = now;
      }

      await supabase
        .from('trade_financial_entries')
        .update(updateData)
        .eq('id', item.source_id);
    }
  } catch (err) {
    console.error('Error syncing status to source:', err);
  }
}

// Helper to send rejection notification to the requester
async function sendRejectionNotification(item: {
  requested_by: string | null;
  code: string;
  supplier_name: string;
  financial_notes: string | null;
}) {
  if (!item.requested_by) return;
  try {
    const motivo = item.financial_notes ? `Motivo: ${item.financial_notes}` : 'Sem motivo informado.';
    await supabase.from('notifications').insert({
      user_id: item.requested_by,
      type: 'payment_rejected',
      title: 'Pagamento Rejeitado',
      message: `Sua solicitação ${item.code} para ${item.supplier_name} foi rejeitada pelo financeiro. ${motivo}`,
      action_url: '/financeiro/pagamentos',
    });
  } catch (err) {
    console.error('Error sending rejection notification:', err);
  }
}

export function useFinancialPaymentQueue(filters?: PaymentQueueFilters) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch payment queue items
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['financial-payment-queue', filters],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        'financial_payment_queue',
        '*',
        (query) => {
          let q = query.order('created_at', { ascending: false });

          if (filters?.status && filters.status !== 'all') {
            q = q.eq('financial_status', filters.status);
          }

          if (filters?.source_type && filters.source_type !== 'all') {
            if (filters.source_type.startsWith('dept:')) {
              const deptName = filters.source_type.replace('dept:', '');
              q = q.eq('source_type', 'department_expense');
              q = q.eq('department_name', deptName);
            } else {
              q = q.eq('source_type', filters.source_type);
            }
          }

          if (filters?.empresa_id && filters.empresa_id !== 'all') {
            q = q.eq('empresa_id', filters.empresa_id);
          }

          if (filters?.search) {
            q = q.or(`supplier_name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,source_code.ilike.%${filters.search}%`);
          }

          if (filters?.startDate) {
            q = q.gte('created_at', filters.startDate.toISOString());
          }

          if (filters?.endDate) {
            q = q.lte('created_at', filters.endDate.toISOString());
          }

          return q;
        }
      );
      
      // Parse attachments from JSONB
      const items = data.map(item => ({
        ...item,
        attachments: (item.attachments as unknown as PaymentAttachment[]) || [],
      })) as PaymentQueueItem[];

      // Resolve user names from profiles
      const userIds = new Set<string>();
      items.forEach(item => {
        if (item.requested_by) userIds.add(item.requested_by);
        if (item.reviewed_by) userIds.add(item.reviewed_by);
      });

      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', Array.from(userIds));

        if (profiles) {
          const nameMap = new Map(profiles.map(p => [p.id, p.nome]));
          items.forEach(item => {
            if (item.requested_by) {
              item.requester_name = nameMap.get(item.requested_by) || undefined;
            }
            if (item.reviewed_by) {
              item.reviewer_name = nameMap.get(item.reviewed_by) || undefined;
            }
          });
        }
      }

      return items;
    },
  });

  // Fetch KPIs
  const { data: kpis } = useQuery({
    queryKey: ['financial-payment-queue-kpis', filters?.startDate, filters?.endDate],
    queryFn: async () => {
      const data = await fetchAllRows<{ financial_status: string; amount: number }>(
        'financial_payment_queue',
        'financial_status, amount',
        (query) => {
          let q = query;
          if (filters?.startDate) {
            q = q.gte('created_at', filters.startDate.toISOString());
          }
          if (filters?.endDate) {
            q = q.lte('created_at', filters.endDate.toISOString());
          }
          return q;
        }
      );

      const pending = data.filter(i => i.financial_status === 'pending');
      const accepted = data.filter(i => i.financial_status === 'accepted');
      const rejected = data.filter(i => i.financial_status === 'rejected');
      const paid = data.filter(i => i.financial_status === 'paid');

      return {
        pendingCount: pending.length,
        pendingAmount: pending.reduce((sum, i) => sum + Number(i.amount), 0),
        acceptedCount: accepted.length,
        acceptedAmount: accepted.reduce((sum, i) => sum + Number(i.amount), 0),
        rejectedCount: rejected.length,
        paidCount: paid.length,
        paidAmount: paid.reduce((sum, i) => sum + Number(i.amount), 0),
        totalAmount: data.reduce((sum, i) => sum + Number(i.amount), 0),
        totalCount: data.length,
      };
    },
  });

  // Create payment queue item
  const createMutation = useMutation({
    mutationFn: async (input: CreatePaymentQueueInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('financial_payment_queue')
        .insert({
          ...input,
          code: '', // Will be auto-generated by trigger
          requested_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-payment-queue'] });
      toast({
        title: "Sucesso",
        description: "Solicitação de pagamento enviada ao financeiro",
      });
    },
    onError: (error) => {
      console.error('Error creating payment queue item:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a solicitação",
        variant: "destructive",
      });
    },
  });

  // Update payment status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, financial_status, financial_notes, payment_method, payment_details, rejection_category, rejection_fields }: UpdatePaymentStatusInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const updateData: Record<string, unknown> = {
        financial_status,
        financial_notes,
        reviewed_by: userData.user?.id,
        reviewed_at: new Date().toISOString(),
      };

      if (financial_status === 'rejected') {
        updateData.rejection_category = rejection_category || null;
        updateData.rejection_fields = rejection_fields || [];
      }

      if (financial_status === 'paid') {
        updateData.paid_at = new Date().toISOString();
        if (payment_method) updateData.payment_method = payment_method;
        if (payment_details) updateData.payment_details = payment_details;
      }

      const { data, error } = await supabase
        .from('financial_payment_queue')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Sync status back to the original source expense
      await syncStatusToSource({
        source_type: data.source_type,
        source_id: data.source_id,
        financial_status: data.financial_status,
      });

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['financial-payment-queue'] });
      
      // Send rejection notification to requester
      if (variables.financial_status === 'rejected' && data) {
        sendRejectionNotification({
          requested_by: data.requested_by,
          code: data.code,
          supplier_name: data.supplier_name,
          financial_notes: variables.financial_notes || null,
        });
      }

      // Auto-export to ERP when marked as paid (baixa)
      if (variables.financial_status === 'paid' && data) {
        exportPaymentToErp(data.id, undefined, 'payment').then((result) => {
          if (result.success) {
            console.log(`ERP payment export success for ${data.code}`);
          } else {
            console.warn(`ERP payment export failed for ${data.code}: ${result.message}`);
          }
        });
      }

      const statusMessages: Record<PaymentQueueStatus, string> = {
        pending: 'Status atualizado',
        accepted: 'Pagamento aceito com sucesso',
        rejected: 'Pagamento rejeitado',
        paid: 'Pagamento marcado como pago',
        cancelled: 'Pagamento cancelado',
      };

      toast({
        title: "Sucesso",
        description: statusMessages[variables.financial_status],
      });
    },
    onError: (error) => {
      console.error('Error updating payment status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    },
  });

  // Accept payment (creates contas_pagar entry)
  const acceptPaymentMutation = useMutation({
    mutationFn: async ({ id, financial_notes }: { id: string; financial_notes?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get the payment queue item
      const { data: item, error: fetchError } = await supabase
        .from('financial_payment_queue')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Create contas_pagar entry using correct column names
      // Generate a unique erp_id since it's required (NOT NULL)
      const erpId = `FPQ-${item.code}-${Date.now()}`;
      
      const contaPagarData = {
        erp_id: erpId,
        fornecedor_nome: item.supplier_name,
        fornecedor_codigo: item.supplier_document,
        tipo_documento: item.document_type,
        numero_documento: item.document_number,
        valor_original: item.amount,
        valor_aberto: item.amount,
        data_vencimento: item.due_date,
        data_emissao: new Date().toISOString().split('T')[0],
        portador: item.portador,
        categoria_nome: `${item.source_type} - ${item.source_code || item.code}`,
        status: 'pendente',
        empresa_id: item.empresa_id || 1, // Fallback para empresa padrão
        empresa_nome: item.empresa_nome || 'Matriz',
      };

      const { data: contaPagar, error: contaError } = await supabase
        .from('contas_pagar')
        .insert(contaPagarData as never)
        .select()
        .single();

      if (contaError) throw contaError;

      // Update payment queue status
      const { data, error } = await supabase
        .from('financial_payment_queue')
        .update({
          financial_status: 'accepted',
          financial_notes,
          reviewed_by: userData.user?.id,
          reviewed_at: new Date().toISOString(),
          contas_pagar_id: contaPagar.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Sync status back to the original source expense
      await syncStatusToSource({
        source_type: item.source_type,
        source_id: item.source_id,
        financial_status: 'accepted',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-payment-queue'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast({
        title: "Pagamento Aceito",
        description: "Registro criado em Contas a Pagar",
      });
    },
    onError: (error) => {
      console.error('Error accepting payment:', error);
      toast({
        title: "Erro",
        description: "Não foi possível aceitar o pagamento",
        variant: "destructive",
      });
    },
  });

  return {
    items,
    kpis: kpis || {
      pendingCount: 0,
      pendingAmount: 0,
      acceptedCount: 0,
      acceptedAmount: 0,
      rejectedCount: 0,
      paidCount: 0,
      paidAmount: 0,
      totalAmount: 0,
      totalCount: 0,
    },
    isLoading,
    refetch,
    createPayment: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
    acceptPayment: acceptPaymentMutation.mutate,
    isAccepting: acceptPaymentMutation.isPending,
  };
}
