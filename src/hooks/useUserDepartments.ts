import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserDepartment {
  id: string;
  nome: string;
  descricao: string | null;
  responsavel_id: string | null;
  ativo: boolean;
  isManager: boolean;
}

export function useUserDepartments() {
  return useQuery({
    queryKey: ["user-departments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's profile to check department_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", user.id)
        .single();

      // Get all departments where user is manager or member
      const { data: departments, error } = await supabase
        .from("departamentos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;

      // Filter departments where user is manager or member
      const userDepartments = (departments || [])
        .filter(dept => 
          dept.responsavel_id === user.id || 
          dept.id === profile?.departamento_id
        )
        .map(dept => ({
          ...dept,
          isManager: dept.responsavel_id === user.id,
        }));

      return userDepartments as UserDepartment[];
    },
  });
}

export function useAllDepartments() {
  return useQuery({
    queryKey: ["all-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamentos")
        .select(`
          *,
          responsavel:profiles!departamentos_responsavel_id_fkey(id, nome)
        `)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });
}

export function useDepartmentById(departmentId: string) {
  return useQuery({
    queryKey: ["department", departmentId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("departamentos")
        .select(`
          *,
          responsavel:profiles!departamentos_responsavel_id_fkey(id, nome)
        `)
        .eq("id", departmentId)
        .single();

      if (error) throw error;

      // Check if user is manager
      const isManager = data.responsavel_id === user.id;

      // Check if user is from financeiro
      const { data: profile } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", user.id)
        .single();

      const { data: financeiroDept } = await supabase
        .from("departamentos")
        .select("id")
        .eq("nome", "Financeiro")
        .single();

      const isFinanceiro = profile?.departamento_id === financeiroDept?.id;

      return {
        ...data,
        isManager,
        isFinanceiro,
      };
    },
    enabled: !!departmentId,
  });
}

export function useIsDepartmentManager(departmentId?: string) {
  return useQuery({
    queryKey: ["is-department-manager", departmentId],
    queryFn: async () => {
      if (!departmentId) return false;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("departamentos")
        .select("responsavel_id")
        .eq("id", departmentId)
        .single();

      if (error) return false;
      return data.responsavel_id === user.id;
    },
    enabled: !!departmentId,
  });
}
