import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemProfile {
  id: string;
  nome: string;
  email: string;
}

export const useSystemProfiles = () => {
  return useQuery({
    queryKey: ["system-profiles-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .order("nome");
      if (error) throw error;
      return (data || []) as SystemProfile[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
