import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EventExpense {
  id: string;
  event_id: string;
  category: string;
  description: string | null;
  valor_previsto: number;
  valor_realizado: number;
  expense_date: string | null;
  status: string;
  comprovante_url: string | null;
  evidencias: any[];
  send_to_financial: boolean;
  supplier_name: string | null;
  supplier_document: string | null;
  document_type: string | null;
  document_number: string | null;
  due_date: string | null;
  portador: string | null;
  payment_notes: string | null;
  financial_approved_by: string | null;
  financial_approved_at: string | null;
  paid_at: string | null;
  contas_pagar_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  event?: {
    id: string;
    code: string;
    name: string;
  };
  creator?: {
    id: string;
    nome: string;
  };
}

export interface CreateExpenseInput {
  event_id: string;
  category: string;
  description?: string;
  valor_previsto?: number;
  valor_realizado?: number;
  expense_date?: string;
  comprovante_url?: string;
}

export interface SendToFinancialInput {
  id: string;
  supplier_name: string;
  supplier_document?: string;
  document_type: string;
  document_number: string;
  due_date: string;
  portador: string;
  payment_notes?: string;
}

export const EXPENSE_CATEGORIES = [
  { value: "alimentacao", label: "Alimentação e Bebidas" },
  { value: "transporte", label: "Transporte e Logística" },
  { value: "hospedagem", label: "Hospedagem" },
  { value: "material", label: "Materiais e Impressos" },
  { value: "servicos", label: "Serviços Terceirizados" },
  { value: "brindes", label: "Brindes e Premiações" },
  { value: "locacao", label: "Locação de Espaço/Equipamentos" },
  { value: "marketing", label: "Divulgação e Marketing" },
  { value: "outros", label: "Outros" },
];

export const DOCUMENT_TYPES = [
  { value: "nf", label: "Nota Fiscal" },
  { value: "nfse", label: "NFS-e (Serviços)" },
  { value: "boleto", label: "Boleto Bancário" },
  { value: "recibo", label: "Recibo" },
  { value: "fatura", label: "Fatura" },
  { value: "duplicata", label: "Duplicata" },
  { value: "outros", label: "Outros" },
];

export function useEventExpenses(eventId?: string) {
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ["event-expenses", eventId],
    queryFn: async () => {
      let query = supabase
        .from("corporate_event_expenses")
        .select(`
          *,
          event:corporate_events(id, code, name),
          creator:profiles!corporate_event_expenses_created_by_fkey(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (eventId) {
        query = query.eq("event_id", eventId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EventExpense[];
    },
    enabled: eventId !== undefined,
  });

  const createExpense = useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .insert({
          ...input,
          created_by: user.id,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["corporate-events"] });
      toast.success("Despesa criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar despesa: ${error.message}`);
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<EventExpense>) => {
      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["corporate-events"] });
      toast.success("Despesa atualizada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar despesa: ${error.message}`);
    },
  });

  const approveExpense = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["corporate-events"] });
      queryClient.invalidateQueries({ queryKey: ["financial-pending-items"] });
      toast.success("Despesa aprovada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar despesa: ${error.message}`);
    },
  });

  const rejectExpense = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .update({
          status: "rejected",
          payment_notes: reason,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-expenses"] });
      toast.success("Despesa rejeitada!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao rejeitar despesa: ${error.message}`);
    },
  });

  const sendToFinancial = useMutation({
    mutationFn: async (input: SendToFinancialInput) => {
      const { id, ...financialData } = input;

      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .update({
          ...financialData,
          send_to_financial: true,
          status: "pending_financial",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-pending-items"] });
      toast.success("Despesa enviada ao financeiro com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar ao financeiro: ${error.message}`);
    },
  });

  const approveFinancial = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .update({
          status: "paid",
          financial_approved_by: user.id,
          financial_approved_at: new Date().toISOString(),
          paid_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-pending-items"] });
      toast.success("Pagamento aprovado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar pagamento: ${error.message}`);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("corporate_event_expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["corporate-events"] });
      toast.success("Despesa excluída com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir despesa: ${error.message}`);
    },
  });

  return {
    expenses: expensesQuery.data ?? [],
    isLoading: expensesQuery.isLoading,
    error: expensesQuery.error,
    refetch: expensesQuery.refetch,
    createExpense,
    updateExpense,
    approveExpense,
    rejectExpense,
    sendToFinancial,
    approveFinancial,
    deleteExpense,
  };
}

export function useFinancialPendingItems() {
  return useQuery({
    queryKey: ["financial-pending-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .select(`
          *,
          event:corporate_events(id, code, name),
          creator:profiles!corporate_event_expenses_created_by_fkey(id, nome)
        `)
        .eq("status", "pending_financial")
        .eq("send_to_financial", true)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as EventExpense[];
    },
  });
}

export function usePortadores() {
  return useQuery({
    queryKey: ["portadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("portador")
        .not("portador", "is", null)
        .limit(100);

      if (error) throw error;
      
      // Get unique portadores
      const uniquePortadores = [...new Set(data?.map(d => d.portador).filter(Boolean))] as string[];
      return uniquePortadores.sort();
    },
  });
}
