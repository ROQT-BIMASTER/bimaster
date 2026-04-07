import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StoreCategory {
  id: string;
  name: string;
  active: boolean;
}

export function useStoreCategories() {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["store-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_categories")
        .select("id, name, active")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as StoreCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["store-categories"] });

  return { categories, isLoading, refetch };
}
