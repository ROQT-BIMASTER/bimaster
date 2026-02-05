import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DepartmentBudget {
  id: string;
  department_id: string;
  code: string;
  name: string;
  total_amount: number;
  spent_amount: number;
  period_start: string;
  period_end: string;
  status: string;
  approval_status: string;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  department?: {
    id: string;
    nome: string;
  };
  creator?: {
    id: string;
    nome: string;
  };
}

export interface CreateDepartmentBudgetInput {
  department_id: string;
  name: string;
  total_amount: number;
  period_start: string;
  period_end: string;
  notes?: string;
  empresa_id?: number;
  empresa_nome?: string;
}

export interface UpdateDepartmentBudgetInput extends Partial<CreateDepartmentBudgetInput> {
  id: string;
  status?: string;
  approval_status?: string;
  spent_amount?: number;
}

export function useDepartmentBudgets(departmentId?: string) {
  const queryClient = useQueryClient();

  const budgetsQuery = useQuery({
    queryKey: ["department-budgets", departmentId],
    queryFn: async () => {
      let query = supabase
        .from("department_budgets")
        .select(`
          *,
          department:departamentos(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (departmentId) {
        query = query.eq("department_id", departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch creators separately
      const creatorIds = [...new Set((data || []).map(b => b.created_by).filter(Boolean))];
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
        creator: item.created_by ? creatorsMap[item.created_by] : undefined,
      })) as DepartmentBudget[];
    },
  });

  const activeBudgetsQuery = useQuery({
    queryKey: ["department-budgets-active", departmentId],
    queryFn: async () => {
      let query = supabase
        .from("department_budgets")
        .select(`
          id, name, code, total_amount, spent_amount,
          department:departamentos(id, nome)
        `)
        .eq("status", "active")
        .eq("approval_status", "approved")
        .order("name");

      if (departmentId) {
        query = query.eq("department_id", departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: departmentId !== undefined,
  });

  const createBudget = useMutation({
    mutationFn: async (input: CreateDepartmentBudgetInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("department_budgets")
        .insert({
          department_id: input.department_id,
          name: input.name,
          total_amount: input.total_amount,
          period_start: input.period_start,
          period_end: input.period_end,
          notes: input.notes,
          empresa_id: input.empresa_id || null,
          empresa_nome: input.empresa_nome || null,
          created_by: user.id,
          status: "pending",
          approval_status: "pending",
          spent_amount: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      toast.success("Verba solicitada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao solicitar verba: ${error.message}`);
    },
  });

  const updateBudget = useMutation({
    mutationFn: async ({ id, department, creator, ...input }: UpdateDepartmentBudgetInput & { department?: unknown; creator?: unknown }) => {
      const { data, error } = await supabase
        .from("department_budgets")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      toast.success("Verba atualizada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar verba: ${error.message}`);
    },
  });

  const approveBudget = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("department_budgets")
        .update({
          status: "active",
          approval_status: "approved",
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
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["pending-department-budgets"] });
      toast.success("Verba aprovada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar verba: ${error.message}`);
    },
  });

  const rejectBudget = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("department_budgets")
        .update({
          status: "closed",
          approval_status: "rejected",
          notes: reason,
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
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["pending-department-budgets"] });
      toast.success("Verba rejeitada.");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao rejeitar verba: ${error.message}`);
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("department_budgets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      toast.success("Verba excluída com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir verba: ${error.message}`);
    },
  });

  return {
    budgets: budgetsQuery.data ?? [],
    activeBudgets: activeBudgetsQuery.data ?? [],
    isLoading: budgetsQuery.isLoading,
    error: budgetsQuery.error,
    refetch: budgetsQuery.refetch,
    createBudget,
    updateBudget,
    approveBudget,
    rejectBudget,
    deleteBudget,
  };
}

export function usePendingDepartmentBudgets() {
  return useQuery({
    queryKey: ["pending-department-budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_budgets")
        .select(`
          *,
          department:departamentos(id, nome)
        `)
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch creators separately
      const creatorIds = [...new Set((data || []).map(b => b.created_by).filter(Boolean))];
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
        creator: item.created_by ? creatorsMap[item.created_by] : undefined,
      })) as DepartmentBudget[];
    },
  });
}
