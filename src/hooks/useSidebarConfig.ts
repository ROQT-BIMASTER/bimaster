import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SidebarCategory {
  id: string;
  key: string;
  label: string;
  icon: string;
  ordem: number;
  ativo: boolean;
  modules: SidebarCategoryModule[];
}

export interface SidebarCategoryModule {
  id: string;
  category_id: string;
  module_code: string;
  label_override: string | null;
  icon_override: string | null;
  ordem: number;
  ativo: boolean;
}

const QUERY_KEY = ["sidebar-config"];

export function useSidebarConfig() {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const [{ data: cats, error: cErr }, { data: mods, error: mErr }] = await Promise.all([
        supabase
          .from("sidebar_categories")
          .select("*")
          .eq("ativo", true)
          .order("ordem"),
        supabase
          .from("sidebar_category_modules")
          .select("*")
          .eq("ativo", true)
          .order("ordem"),
      ]);

      if (cErr) throw cErr;
      if (mErr) throw mErr;

      return (cats || []).map((cat: any) => ({
        ...cat,
        modules: (mods || []).filter((m: any) => m.category_id === cat.id),
      })) as SidebarCategory[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateCategory = useMutation({
    mutationFn: async (cat: Partial<SidebarCategory> & { id: string }) => {
      const { modules, ...data } = cat as any;
      const { error } = await supabase
        .from("sidebar_categories")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const createCategory = useMutation({
    mutationFn: async (cat: { key: string; label: string; icon: string; ordem: number }) => {
      const { data, error } = await supabase
        .from("sidebar_categories")
        .insert(cat)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sidebar_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateModuleMapping = useMutation({
    mutationFn: async (mod: Partial<SidebarCategoryModule> & { id: string }) => {
      const { error } = await supabase
        .from("sidebar_category_modules")
        .update(mod)
        .eq("id", mod.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const moveModule = useMutation({
    mutationFn: async ({ moduleId, newCategoryId, newOrdem }: { moduleId: string; newCategoryId: string; newOrdem: number }) => {
      const { error } = await supabase
        .from("sidebar_category_modules")
        .update({ category_id: newCategoryId, ordem: newOrdem })
        .eq("id", moduleId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reorderCategories = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        supabase.from("sidebar_categories").update({ ordem: idx + 1 }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reorderModules = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        supabase.from("sidebar_category_modules").update({ ordem: idx + 1 }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    categories,
    isLoading,
    updateCategory,
    createCategory,
    deleteCategory,
    updateModuleMapping,
    moveModule,
    reorderCategories,
    reorderModules,
  };
}
