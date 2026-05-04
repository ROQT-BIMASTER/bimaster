import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ModoVisao = "minhas" | "equipe" | "coordenacao" | "todas";
export type AgruparPor = "pipeline" | "projeto" | "prazo";

export interface KanbanPrefs {
  user_id: string;
  pipelines_visiveis: string[];
  modo_visao: ModoVisao;
  agrupar_por: AgruparPor;
  mostrar_finalizados: boolean;
  ordem_colunas: Record<string, string[]>;
}

const DEFAULT: Omit<KanbanPrefs, "user_id"> = {
  pipelines_visiveis: [],
  modo_visao: "minhas",
  agrupar_por: "pipeline",
  mostrar_finalizados: false,
  ordem_colunas: {},
};

export function useKanbanPreferencias() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["kanban-prefs", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<KanbanPrefs> => {
      const { data, error } = await supabase
        .from("kanban_aprovacoes_preferencias" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { user_id: user!.id, ...DEFAULT };
      return data as unknown as KanbanPrefs;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Omit<KanbanPrefs, "user_id">>) => {
      if (!user?.id) throw new Error("não autenticado");
      const current = query.data ?? { user_id: user.id, ...DEFAULT };
      const merged = { ...current, ...patch, user_id: user.id };
      const { error } = await supabase
        .from("kanban_aprovacoes_preferencias" as any)
        .upsert(merged, { onConflict: "user_id" });
      if (error) throw error;
      return merged;
    },
    onSuccess: (data) => {
      qc.setQueryData(["kanban-prefs", user?.id], data);
      qc.invalidateQueries({ queryKey: ["kanban-aprovacoes"] });
      toast.success("Preferências salvas");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar"),
  });

  return { prefs: query.data ?? { user_id: user?.id ?? "", ...DEFAULT }, isLoading: query.isLoading, update };
}
