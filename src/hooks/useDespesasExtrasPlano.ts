import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DespesaExtraTipo = "eliminar" | "reduzir" | "manter";

export interface DespesaExtra {
  id: string;
  plano_id: string;
  categoria: string;
  descricao: string;
  valor_mensal: number;
  valores_mensais: Record<string, number>;
  tipo: DespesaExtraTipo;
  ordem: number;
  criado_por: string;
  created_at: string;
  updated_at: string;
}

export interface DespesaExtraInput {
  categoria: string;
  descricao: string;
  valor_mensal: number;
  valores_mensais?: Record<string, number>;
  tipo?: DespesaExtraTipo;
  ordem?: number;
}

export function useDespesasExtrasPlano(planoId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["despesas-extras-plano", planoId],
    enabled: !!planoId,
    queryFn: async (): Promise<DespesaExtra[]> => {
      const { data, error } = await supabase
        .from("plano_reducao_despesas_extras")
        .select("*")
        .eq("plano_id", planoId!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        valor_mensal: Number(d.valor_mensal || 0),
        valores_mensais: d.valores_mensais || {},
      }));
    },
  });

  const create = useMutation({
    mutationFn: async (input: DespesaExtraInput) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { error } = await supabase.from("plano_reducao_despesas_extras").insert({
        plano_id: planoId!,
        categoria: input.categoria,
        descricao: input.descricao,
        valor_mensal: input.valor_mensal,
        valores_mensais: input.valores_mensais || {},
        tipo: input.tipo || "eliminar",
        ordem: input.ordem ?? 0,
        criado_por: u.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas-extras-plano", planoId] });
      toast.success("Despesa adicionada");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao adicionar despesa"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DespesaExtraInput> }) => {
      const { error } = await supabase
        .from("plano_reducao_despesas_extras")
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["despesas-extras-plano", planoId] }),
    onError: (e: any) => toast.error(e.message || "Falha ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plano_reducao_despesas_extras")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas-extras-plano", planoId] });
      toast.success("Despesa removida");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao remover"),
  });

  const bulkInsert = useMutation({
    mutationFn: async (items: DespesaExtraInput[]) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const rows = items.map((i, idx) => ({
        plano_id: planoId!,
        categoria: i.categoria,
        descricao: i.descricao,
        valor_mensal: i.valor_mensal,
        valores_mensais: i.valores_mensais || {},
        tipo: i.tipo || "eliminar",
        ordem: i.ordem ?? idx,
        criado_por: u.user.id,
      }));
      const { error } = await supabase.from("plano_reducao_despesas_extras").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas-extras-plano", planoId] });
      toast.success("Despesas adicionadas");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao inserir despesas"),
  });

  return { ...query, create, update, remove, bulkInsert };
}
