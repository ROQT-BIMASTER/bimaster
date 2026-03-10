import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ChinaUserContext {
  isChinaUser: boolean;
  isBrasilUser: boolean;
  loading: boolean;
}

export function useChinaUserContext(): ChinaUserContext {
  const { data, isLoading } = useQuery({
    queryKey: ["china-user-context"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isChinaUser: false, isBrasilUser: false };

      // Check admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData?.role === "admin") {
        return { isChinaUser: false, isBrasilUser: true };
      }

      // Get user's department
      const { data: profile } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", user.id)
        .single();

      if (!profile?.departamento_id) {
        return { isChinaUser: false, isBrasilUser: true };
      }

      // Check if department is "China"
      const { data: dept } = await supabase
        .from("departamentos")
        .select("nome")
        .eq("id", profile.departamento_id)
        .single();

      const isChinaUser = dept?.nome?.toLowerCase() === "china";

      return {
        isChinaUser,
        isBrasilUser: !isChinaUser,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    isChinaUser: data?.isChinaUser ?? false,
    isBrasilUser: data?.isBrasilUser ?? true,
    loading: isLoading,
  };
}
