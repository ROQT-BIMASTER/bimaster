import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DEFAULT_WIDGETS, type WidgetConfig } from "@/components/minhas-tarefas/widgets/WidgetRegistry";

export interface CustomDashboard {
  id: string;
  user_id: string;
  nome: string;
  widgets: WidgetConfig[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useCustomDashboards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["custom-dashboards", user?.id];

  const { data: dashboards = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_custom_dashboards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        widgets: (d.widgets as any[]) || [],
      })) as CustomDashboard[];
    },
    enabled: !!user?.id,
  });

  const createDashboard = useMutation({
    mutationFn: async (nome: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("user_custom_dashboards")
        .insert({
          user_id: user.id,
          nome,
          widgets: DEFAULT_WIDGETS as any,
          is_default: dashboards.length === 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Dashboard criado!");
    },
    onError: () => toast.error("Erro ao criar dashboard"),
  });

  const updateWidgets = useMutation({
    mutationFn: async ({ id, widgets }: { id: string; widgets: WidgetConfig[] }) => {
      const { error } = await supabase
        .from("user_custom_dashboards")
        .update({ widgets: widgets as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const renameDashboard = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase
        .from("user_custom_dashboards")
        .update({ nome })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Dashboard renomeado!");
    },
  });

  const deleteDashboard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_custom_dashboards")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Dashboard excluído!");
    },
  });

  return {
    dashboards,
    isLoading,
    createDashboard,
    updateWidgets,
    renameDashboard,
    deleteDashboard,
  };
}
