import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DepartmentExpense, ExpenseAttachment } from "./useDepartmentExpenses";

export interface ManagerPendingExpensesResult {
  expenses: DepartmentExpense[];
  departments: { id: string; nome: string }[];
  metrics: {
    totalPending: number;
    totalValue: number;
    departmentsCount: number;
  };
  isManager: boolean;
}

export function useManagerPendingExpenses() {
  return useQuery({
    queryKey: ["manager-pending-expenses"],
    queryFn: async (): Promise<ManagerPendingExpensesResult> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { 
        expenses: [], 
        departments: [], 
        metrics: { totalPending: 0, totalValue: 0, departmentsCount: 0 },
        isManager: false 
      };

      // Check if user is admin/supervisor
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdminOrSupervisor = 
        roleData?.role === "admin" || roleData?.role === "supervisor";

      // Get departments where user is manager
      let departmentsQuery = supabase
        .from("departamentos")
        .select("id, nome")
        .eq("ativo", true);

      if (!isAdminOrSupervisor) {
        departmentsQuery = departmentsQuery.eq("responsavel_id", user.id);
      }

      const { data: departments, error: deptError } = await departmentsQuery;
      
      if (deptError) throw deptError;
      if (!departments?.length) {
        return { 
          expenses: [], 
          departments: [], 
          metrics: { totalPending: 0, totalValue: 0, departmentsCount: 0 },
          isManager: false 
        };
      }

      // Fetch pending expenses for these departments
      const departmentIds = departments.map(d => d.id);
      const { data: expenses, error: expError } = await supabase
        .from("department_expenses")
        .select(`
          *,
          department:departamentos(id, nome),
          empresa:empresas(id, nome)
        `)
        .in("department_id", departmentIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (expError) throw expError;

      // Fetch creators separately
      const creatorIds = [...new Set((expenses || []).map(e => e.created_by).filter(Boolean))];
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

      const enrichedExpenses = (expenses || []).map(item => ({
        ...item,
        attachments: (item.attachments as unknown as ExpenseAttachment[]) || [],
        creator: item.created_by ? creatorsMap[item.created_by] : undefined,
        empresa: item.empresa as unknown as { id: number; nome: string } | undefined,
      })) as DepartmentExpense[];

      const totalValue = enrichedExpenses.reduce(
        (sum, e) => sum + (e.valor_realizado || e.valor_previsto || 0), 
        0
      );

      return {
        expenses: enrichedExpenses,
        departments,
        metrics: {
          totalPending: enrichedExpenses.length,
          totalValue,
          departmentsCount: departments.length,
        },
        isManager: true,
      };
    },
  });
}
