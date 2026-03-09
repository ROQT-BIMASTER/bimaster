import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ExpenseAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export interface DepartmentExpense {
  id: string;
  department_id: string;
  budget_id: string | null;
  code: string;
  category: string;
  description: string | null;
  valor_previsto: number;
  valor_realizado: number;
  expense_date: string | null;
  status: string;
  supplier_name: string | null;
  supplier_document: string | null;
  document_type: string | null;
  document_number: string | null;
  due_date: string | null;
  portador: string | null;
  attachments: ExpenseAttachment[];
  payment_notes: string | null;
  send_to_financial: boolean;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  financial_approved_by: string | null;
  financial_approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Multi-filial fields
  empresa_id: number | null;
  empresa_nome: string | null;
  department?: {
    id: string;
    nome: string;
  };
  budget?: {
    id: string;
    name: string;
    code: string;
  };
  creator?: {
    id: string;
    nome: string;
  };
  empresa?: {
    id: number;
    nome: string;
  };
}

export interface CreateDepartmentExpenseInput {
  department_id: string;
  budget_id?: string;
  category: string;
  description?: string;
  valor_previsto?: number;
  valor_realizado?: number;
  expense_date?: string;
  empresa_id?: number;
  empresa_nome?: string;
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
  payment_queue_id?: string | null;
}

export const DEPARTMENT_EXPENSE_CATEGORIES = [
  { value: "viagem", label: "Viagem e Hospedagem" },
  { value: "transporte", label: "Transporte" },
  { value: "material", label: "Material de Escritório" },
  { value: "equipamento", label: "Equipamentos" },
  { value: "servicos", label: "Serviços Terceirizados" },
  { value: "treinamento", label: "Treinamento e Capacitação" },
  { value: "software", label: "Software e Licenças" },
  { value: "marketing", label: "Marketing e Divulgação" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "manutencao", label: "Manutenção" },
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

export function useDepartmentExpenses(departmentId?: string) {
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ["department-expenses", departmentId],
    queryFn: async () => {
      let query = supabase
        .from("department_expenses")
        .select(`
          *,
          department:departamentos(id, nome),
          budget:department_budgets(id, name, code),
          empresa:empresas(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (departmentId) {
        query = query.eq("department_id", departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch creators separately
      const creatorIds = [...new Set((data || []).map(e => e.created_by).filter(Boolean))];
      let creatorsMap: Record<string, { id: string; nome: string }> = {};
      
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", creatorIds);
        
        creatorsMap = (creators || []).reduce((acc, c) => {
          acc[c.id] = c;
          return acc;
        }, {} as Record<string, { id: string; nome: string }>);
      }

      return (data || []).map(item => ({
        ...item,
        attachments: (item.attachments as unknown as ExpenseAttachment[]) || [],
        creator: item.created_by ? creatorsMap[item.created_by] : undefined,
        empresa: item.empresa as unknown as { id: number; nome: string } | undefined,
      })) as DepartmentExpense[];
    },
    enabled: departmentId !== undefined,
  });

  const createExpense = useMutation({
    mutationFn: async (input: CreateDepartmentExpenseInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("department_expenses")
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
      queryClient.invalidateQueries({ queryKey: ["department-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      toast.success("Despesa criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar despesa: ${error.message}`);
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, attachments, department, budget, creator, ...input }: { id: string } & Partial<DepartmentExpense>) => {
      const updateData: Record<string, unknown> = { ...input };
      if (attachments !== undefined) {
        updateData.attachments = attachments as unknown;
      }
      
      const { data, error } = await supabase
        .from("department_expenses")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
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
        .from("department_expenses")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Send email notification (fire-and-forget)
      supabase.functions.invoke("send-department-expense-notification", {
        body: { expenseId: id, status: "approved" },
      }).catch(err => console.error("Error sending approval notification:", err));

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["pending-department-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["manager-pending-expenses"] });
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
        .from("department_expenses")
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

      // Send email notification (fire-and-forget)
      supabase.functions.invoke("send-department-expense-notification", {
        body: { expenseId: id, status: "rejected", rejectionReason: reason },
      }).catch(err => console.error("Error sending rejection notification:", err));

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["pending-department-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["manager-pending-expenses"] });
      toast.success("Despesa rejeitada!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao rejeitar despesa: ${error.message}`);
    },
  });

  const sendToFinancial = useMutation({
    mutationFn: async (input: SendToFinancialInput) => {
      const { id, ...financialData } = input;

      // First, get the expense to retrieve attachments, department, and empresa
      const { data: expense, error: fetchError } = await supabase
        .from("department_expenses")
        .select("attachments, empresa_id, empresa_nome, department:departamentos(nome)")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Update the expense with financial data
      const { data, error } = await supabase
        .from("department_expenses")
        .update({
          ...financialData,
          send_to_financial: true,
          status: "pending_financial",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Create entry in financial_payment_queue with attachments
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: queueEntry, error: queueError } = await supabase
        .from("financial_payment_queue")
        .insert({
          code: '', // Will be auto-generated by trigger
          source_type: 'department_expense',
          source_id: id,
          source_code: data.code || null,
          supplier_name: financialData.supplier_name,
          supplier_document: financialData.supplier_document || null,
          document_type: financialData.document_type,
          document_number: financialData.document_number,
          amount: data.valor_realizado || 0,
          due_date: financialData.due_date,
          portador: financialData.portador,
          description: data.description,
          notes: financialData.payment_notes,
          department_name: expense?.department?.nome || 'Departamento',
          requested_by: userData.user?.id,
          attachments: expense?.attachments || [],
          empresa_id: expense?.empresa_id,
          empresa_nome: expense?.empresa_nome,
        })
        .select("id")
        .single();

      if (queueError) throw queueError;

      // Save payment_queue_id back to source table
      if (queueEntry) {
        await supabase
          .from("department_expenses")
          .update({ payment_queue_id: queueEntry.id })
          .eq("id", id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-payment-queue"] });
      toast.success("Despesa enviada ao financeiro com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar ao financeiro: ${error.message}`);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("department_expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
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
    deleteExpense,
  };
}

export function usePendingDepartmentExpenses(departmentId?: string) {
  return useQuery({
    queryKey: ["pending-department-expenses", departmentId],
    queryFn: async () => {
      let query = supabase
        .from("department_expenses")
        .select(`
          *,
          department:departamentos(id, nome)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (departmentId) {
        query = query.eq("department_id", departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch creators separately
      const creatorIds = [...new Set((data || []).map(e => e.created_by).filter(Boolean))];
      let creatorsMap: Record<string, { id: string; nome: string }> = {};
      
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", creatorIds);
        
        creatorsMap = (creators || []).reduce((acc, c) => {
          acc[c.id] = c;
          return acc;
        }, {} as Record<string, { id: string; nome: string }>);
      }

      return (data || []).map(item => ({
        ...item,
        attachments: (item.attachments as unknown as ExpenseAttachment[]) || [],
        creator: item.created_by ? creatorsMap[item.created_by] : undefined,
      })) as DepartmentExpense[];
    },
  });
}
