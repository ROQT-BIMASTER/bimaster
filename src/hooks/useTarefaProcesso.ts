import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TarefaProcesso {
  id: string;
  produto_tipo: string;
  produto_ref_id: string;
  numero_processo: string;
  etapa_atual: string;
  status: string;
}

/**
 * Resolve o `product_process` associado a uma tarefa via produto_id.
 * Como `product_process.produto_ref_id` aponta para o id do produto (china/brasil/fabrica),
 * basta procurar o processo onde produto_ref_id = produto_id da tarefa.
 */
export function useTarefaProcesso(produtoId: string | null | undefined) {
  const queryClient = useQueryClient();

  const { data: processo, isLoading } = useQuery({
    queryKey: ["tarefa-processo", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("product_process" as any)
        .select("id, produto_tipo, produto_ref_id, numero_processo, etapa_atual, status")
        .eq("produto_ref_id", produtoId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      if (error) throw error;
      return (data as TarefaProcesso) || null;
    },
  });

  /**
   * Busca processos por número, código ou nome do produto associado.
   * Usado pela pesquisa do Gerente.
   */
  const searchProcessos = async (term: string): Promise<Array<TarefaProcesso & { produto_codigo?: string; produto_nome?: string }>> => {
    if (!term || term.trim().length < 2) return [];
    const t = term.trim();

    const { data, error } = await (supabase
      .from("product_process" as any)
      .select("id, produto_tipo, produto_ref_id, numero_processo, etapa_atual, status")
      .ilike("numero_processo", `%${t}%`)
      .order("created_at", { ascending: false })
      .limit(20) as any);
    if (error) throw error;

    const list = (data || []) as TarefaProcesso[];
    if (list.length === 0) return [];

    // Enriquecer com código/nome do produto china (mais comum no contexto)
    const chinaIds = list.filter((p) => p.produto_tipo === "china").map((p) => p.produto_ref_id);
    let chinaMap: Record<string, { codigo: string; nome: string }> = {};
    if (chinaIds.length > 0) {
      const { data: subs } = await (supabase
        .from("china_produto_submissoes" as any)
        .select("id, produto_codigo, produto_nome")
        .in("id", chinaIds) as any);
      chinaMap = Object.fromEntries(((subs || []) as any[]).map((s) => [s.id, { codigo: s.produto_codigo, nome: s.produto_nome }]));
    }

    return list.map((p) => ({
      ...p,
      produto_codigo: chinaMap[p.produto_ref_id]?.codigo,
      produto_nome: chinaMap[p.produto_ref_id]?.nome,
    }));
  };

  /**
   * Cria um processo para o produto da tarefa (caso ainda não exista).
   */
  const criarProcesso = useMutation({
    mutationFn: async (params: { produto_tipo?: string }) => {
      if (!produtoId) throw new Error("Produto não vinculado");
      const { data: { user } } = await supabase.auth.getUser();
      const tipo = params.produto_tipo || "china";

      const { data, error } = await (supabase
        .from("product_process" as any)
        .insert({
          produto_tipo: tipo,
          produto_ref_id: produtoId,
          criado_por: user?.id,
          etapa_atual: "ideia",
        })
        .select()
        .single() as any);

      if (error) {
        // talvez tenha sido criado por trigger
        const { data: retry } = await (supabase
          .from("product_process" as any)
          .select("*")
          .eq("produto_ref_id", produtoId)
          .maybeSingle() as any);
        if (retry) return retry;
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-processo", produtoId] });
      toast.success("Processo criado");
    },
    onError: (err: any) => toast.error("Falha ao criar processo: " + (err?.message || "erro desconhecido")),
  });

  return {
    processo: (processo || null) as TarefaProcesso | null,
    isLoading,
    searchProcessos,
    criarProcesso,
  };
}
