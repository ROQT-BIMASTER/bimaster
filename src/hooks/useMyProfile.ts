import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MyProfile {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  email: string | null;
  cargo: string | null;
  departamento: string | null;
  supervisor_id: string | null;
}

/**
 * Centralized hook for the current user's profile. Use this everywhere
 * instead of ad-hoc `from("profiles").select(...).eq("id", user.id)` queries
 * so TanStack Query can dedupe and cache across components.
 *
 * If you need an extra column, ADD IT HERE — don't fork the query.
 */
export function useMyProfile() {
  const { user } = useAuth();
  return useQuery<MyProfile | null>({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, email, cargo, departamento, supervisor_id")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as MyProfile | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
