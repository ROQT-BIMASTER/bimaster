import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SELECT_COLS =
  "id, codigo, sku, nome, foto_url, marca, linha, fornecedor:fabrica_produto_fornecedores(fornecedor:fabrica_fornecedores(nome)), custo_unitario, modo, sugestao_pai_id, vencedor_produto_id, ativo, tipo";

export interface ConcorrenteSugestao {
  id: string;
  codigo: string;
  sku: string | null;
  nome: string;
  foto_url: string | null;
  marca: string | null;
  linha: string | null;
  custo_unitario: number | null;
  modo: string;
  sugestao_pai_id: string | null;
  vencedor_produto_id: string | null;
  ativo: boolean | null;
  tipo: string | null;
}

/** Lista concorrentes (modo cenario ou arquivado) vinculados a uma Sugestão. */
export function useConcorrentesSugestao(sugestaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["fabrica-sugestao-concorrentes", sugestaoId],
    enabled: !!sugestaoId,
    queryFn: async (): Promise<ConcorrenteSugestao[]> => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, sku, nome, foto_url, marca, linha, custo_unitario, modo, sugestao_pai_id, vencedor_produto_id, ativo, tipo")
        .eq("sugestao_pai_id", sugestaoId!)
        .order("custo_unitario", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as ConcorrenteSugestao[];
    },
  });
}

/** Busca produtos candidatos para virar concorrentes (acabados que não são Sugestão, não são kits). */
export function useBuscarProdutoParaVincular(termo: string, sugestaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["fabrica-buscar-para-vincular", termo, sugestaoId],
    enabled: !!sugestaoId && termo.trim().length >= 2,
    queryFn: async () => {
      const like = `%${termo.trim()}%`;
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, sku, nome, foto_url, marca, custo_unitario, modo, sugestao_pai_id, is_sugestao, tipo")
        .or(`codigo.ilike.${like},nome.ilike.${like},sku.ilike.${like}`)
        .neq("tipo", "DISPLAY")
        .eq("is_sugestao", false)
        .neq("id", sugestaoId!)
        .is("sugestao_pai_id", null)
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useVincularConcorrente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { sugestao_id: string; concorrente_id: string }) => {
      const { error } = await supabase.rpc("rpc_vincular_concorrente_sugestao" as any, {
        p_sugestao_id: params.sugestao_id,
        p_concorrente_id: params.concorrente_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fabrica-sugestao-concorrentes", vars.sugestao_id] });
      qc.invalidateQueries({ queryKey: ["fabrica-produtos-acabados"] });
      toast.success("Concorrente vinculado");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao vincular concorrente"),
  });
}

export function useDesvincularConcorrente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (concorrente_id: string) => {
      const { error } = await supabase.rpc("rpc_desvincular_concorrente_sugestao" as any, {
        p_concorrente_id: concorrente_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fabrica-sugestao-concorrentes"] });
      qc.invalidateQueries({ queryKey: ["fabrica-produtos-acabados"] });
      toast.success("Concorrente desvinculado");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao desvincular"),
  });
}

export function usePromoverVencedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { sugestao_id: string; vencedor_id: string }) => {
      const { error } = await supabase.rpc("rpc_promover_vencedor_sugestao" as any, {
        p_sugestao_id: params.sugestao_id,
        p_vencedor_id: params.vencedor_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fabrica-sugestao-concorrentes", vars.sugestao_id] });
      qc.invalidateQueries({ queryKey: ["fabrica-produtos-acabados"] });
      toast.success("Vencedor definido");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao promover vencedor"),
  });
}

export function useReabrirDisputa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sugestao_id: string) => {
      const { error } = await supabase.rpc("rpc_reabrir_disputa_sugestao" as any, {
        p_sugestao_id: sugestao_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, sugestao_id) => {
      qc.invalidateQueries({ queryKey: ["fabrica-sugestao-concorrentes", sugestao_id] });
      qc.invalidateQueries({ queryKey: ["fabrica-produtos-acabados"] });
      toast.success("Disputa reaberta");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao reabrir disputa"),
  });
}
