import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProcessTipoDocumento {
  id: string;
  valor: string;
  label: string;
  modulo: string | null;
  projeto_id: string | null;
  origem: string;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
}

export function useProcessTiposDocumento(filters?: { modulo?: string; projetoId?: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["process-tipos-documento", filters?.modulo, filters?.projetoId],
    queryFn: async () => {
      let query = (supabase
        .from("process_tipos_documento" as any)
        .select("*")
        .eq("ativo", true)
        .order("label", { ascending: true }) as any);

      const { data, error } = await query;
      if (error) throw error;

      let result = (data || []) as ProcessTipoDocumento[];

      // Client-side filtering: show global types + types matching filters
      if (filters?.modulo || filters?.projetoId) {
        result = result.filter(t =>
          (!t.modulo && !t.projeto_id) || // global types always shown
          (filters?.modulo && t.modulo === filters.modulo) ||
          (filters?.projetoId && t.projeto_id === filters.projetoId)
        );
      }

      return result;
    },
  });

  const addTipo = useMutation({
    mutationFn: async (input: {
      label: string;
      modulo?: string;
      projeto_id?: string;
    }) => {
      const valor = input.label.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

      const { error } = await (supabase
        .from("process_tipos_documento" as any)
        .insert({
          valor,
          label: input.label.trim(),
          modulo: input.modulo || null,
          projeto_id: input.projeto_id || null,
          origem: "manual",
          created_by: user?.id,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-tipos-documento"] });
      toast.success("Tipo de documento criado com sucesso");
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.error("Já existe um tipo com esse nome");
      } else {
        toast.error("Erro ao criar tipo: " + err.message);
      }
    },
  });

  const toggleTipo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase
        .from("process_tipos_documento" as any)
        .update({ ativo })
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-tipos-documento"] });
    },
  });

  return { tipos, isLoading, addTipo, toggleTipo };
}
