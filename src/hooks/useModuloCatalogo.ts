import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ModuloCatalogo {
  codigo: string;
  label: string;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  rota: string;
  entidade_alvo: string;
  param_template: string | null;
  cria_registro_automatico: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

const KEY = ["modulo-catalogo"];

export function useModuloCatalogo(somenteAtivos = true) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [...KEY, somenteAtivos],
    queryFn: async () => {
      let q = (supabase as any)
        .from("processo_modulo_catalogo")
        .select("*")
        .order("ordem");
      if (somenteAtivos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ModuloCatalogo[];
    },
    staleTime: 5 * 60_000,
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<ModuloCatalogo> & { codigo: string; label: string; rota: string }) => {
      const { error } = await (supabase as any)
        .from("processo_modulo_catalogo")
        .upsert(input, { onConflict: "codigo" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Módulo salvo no catálogo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar módulo"),
  });

  const remove = useMutation({
    mutationFn: async (codigo: string) => {
      const { error } = await (supabase as any)
        .from("processo_modulo_catalogo")
        .delete()
        .eq("codigo", codigo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Módulo removido do catálogo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  return { catalogo: list.data ?? [], isLoading: list.isLoading, upsert, remove };
}

export function useModuloCatalogoItem(codigo: string | null | undefined) {
  return useQuery({
    queryKey: ["modulo-catalogo-item", codigo],
    enabled: !!codigo,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_modulo_catalogo")
        .select("*")
        .eq("codigo", codigo)
        .maybeSingle();
      if (error) throw error;
      return data as ModuloCatalogo | null;
    },
  });
}
