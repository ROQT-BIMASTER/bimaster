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

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin = roleData?.role === "admin";

      // Get user's profile to check department_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", user.id)
        .single();

      // Get all departments
      const { data: departments, error } = await supabase
        .from("departamentos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;

      // Admins see all departments, others see only their own
      const userDepartments = (departments || [])
        .filter(dept => 
          isAdmin || 
          dept.responsavel_id === user.id || 
          dept.id === profile?.departamento_id
        )
        .map(dept => ({
          ...dept,
          isManager: isAdmin || dept.responsavel_id === user.id,
        }));

      return userDepartments as UserDepartment[];
    },
  });
}

export function useAllDepartments() {
  return useQuery({
    queryKey: ["all-departments"],
    queryFn: async () => {
      // Buscar departamentos
      const { data: departments, error } = await supabase
        .from("departamentos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;

      // Buscar responsáveis em batch
      const responsavelIds = departments
        ?.map(d => d.responsavel_id)
        .filter((id): id is string => !!id) || [];

      let responsaveisMap: Record<string, { id: string; nome: string }> = {};
      
      if (responsavelIds.length > 0) {
        const { data: responsaveis } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", responsavelIds);
        
        responsaveisMap = (responsaveis || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, { id: string; nome: string }>);
      }

      return (departments || []).map(dept => ({
        ...dept,
        responsavel: dept.responsavel_id ? responsaveisMap[dept.responsavel_id] || null : null,
      }));
    },
  });
}

export function useDepartmentById(departmentId: string) {
  return useQuery({
    queryKey: ["department", departmentId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin = roleData?.role === "admin";

      const { data, error } = await supabase
        .from("departamentos")
        .select("*")
        .eq("id", departmentId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Buscar responsável separadamente se existir
      let responsavel = null;
      if (data.responsavel_id) {
        const { data: respData } = await supabase
          .from("profiles")
          .select("id, nome")
          .eq("id", data.responsavel_id)
          .maybeSingle();
        responsavel = respData;
      }

      // Admin ou responsável é considerado manager
      const isManager = isAdmin || data.responsavel_id === user.id;

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
        .maybeSingle();

      const isFinanceiro = profile?.departamento_id === financeiroDept?.id;

      return {
        ...data,
        responsavel,
        isManager,
        isFinanceiro,
        isAdmin,
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
