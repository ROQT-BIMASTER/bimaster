import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CalendarioRegra {
  id: string;
  projeto_id: string;
  titulo: string;
  tipo: string;
  operador: string;
  valor: number;
  periodo: string;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjetoCalendarioRegras(projetoId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["projeto-calendario-regras", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      const { data, error } = await supabase
        .from("projeto_calendario_regras" as any)
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CalendarioRegra[];
    },
    enabled: !!projetoId,
  });

  const createRegra = useMutation({
    mutationFn: async (regra: Omit<CalendarioRegra, "id" | "created_at" | "updated_at" | "created_by">) => {
      const { error } = await supabase
        .from("projeto_calendario_regras" as any)
        .insert({ ...regra, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-calendario-regras", projetoId] });
      toast.success("Regra criada com sucesso");
    },
    onError: () => toast.error("Erro ao criar regra"),
  });

  const updateRegra = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CalendarioRegra> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_calendario_regras" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-calendario-regras", projetoId] });
    },
  });

  const deleteRegra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projeto_calendario_regras" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-calendario-regras", projetoId] });
      toast.success("Regra removida");
    },
  });

  return { regras, isLoading, createRegra, updateRegra, deleteRegra };
}
