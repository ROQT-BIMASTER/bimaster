import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ChinaTarefaVinculo {
  id: string;
  submissao_id: string;
  tarefa_id: string;
  secao_id: string | null;
  projeto_id: string;
  audit_result: any;
  created_by: string | null;
  created_at: string;
}

export function useSubmissoesChina(search: string) {
  return useQuery({
    queryKey: ["china-submissoes-lista", search],
    queryFn: async () => {
      let query = supabase
        .from("china_produto_submissoes")
        .select("id, produto_codigo, produto_nome, status, formula_codigo, ean_unidade, ean_display, ean_caixa_master, peso_liquido_g, peso_bruto_g, qty_total, observacoes_brasil, observacoes_china, numero_ordem, numero_item")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (search.trim()) {
        query = query.or(`produto_codigo.ilike.%${search}%,produto_nome.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useProjetosParaVinculo() {
  return useQuery({
    queryKey: ["projetos-para-vinculo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, cor, status, codigo")
        .neq("status", "arquivado")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSecoesETarefas(projetoId: string | null) {
  return useQuery({
    queryKey: ["secoes-tarefas-vinculo", projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const [secoesRes, tarefasRes] = await Promise.all([
        supabase
          .from("projeto_secoes")
          .select("id, nome, ordem")
          .eq("projeto_id", projetoId!)
          .order("ordem"),
        supabase
          .from("projeto_tarefas")
          .select("id, titulo, secao_id, codigo, status, estagio")
          .eq("projeto_id", projetoId!)
          .is("excluida_em" as any, null)
          .is("parent_tarefa_id", null)
          .order("ordem"),
      ]);

      if (secoesRes.error) throw secoesRes.error;
      if (tarefasRes.error) throw tarefasRes.error;

      return {
        secoes: secoesRes.data || [],
        tarefas: tarefasRes.data || [],
      };
    },
  });
}

export function useVinculosExistentes(projetoId: string | null) {
  return useQuery({
    queryKey: ["china-tarefa-vinculos", projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_submissao_tarefa_vinculos" as any)
        .select("*")
        .eq("projeto_id", projetoId!) as any);
      if (error) throw error;
      return (data || []) as ChinaTarefaVinculo[];
    },
  });
}

export function useAllVinculos() {
  return useQuery({
    queryKey: ["china-tarefa-vinculos-all"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_submissao_tarefa_vinculos" as any)
        .select("*, submissao:china_produto_submissoes(produto_codigo, produto_nome, status)") as any);
      if (error) throw error;
      return (data || []) as (ChinaTarefaVinculo & { submissao?: { produto_codigo: string; produto_nome: string; status: string } })[];
    },
  });
}

export function useCreateVinculo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      submissao_id: string;
      tarefa_id: string;
      secao_id: string | null;
      projeto_id: string;
      audit_result?: any;
    }) => {
      const { error } = await (supabase
        .from("china_submissao_tarefa_vinculos" as any)
        .insert({
          ...params,
          created_by: user?.id || null,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-tarefa-vinculos"] });
      queryClient.invalidateQueries({ queryKey: ["china-tarefa-vinculos-all"] });
      toast.success("Vínculo criado com sucesso");
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast.error("Esta tarefa já está vinculada a esta submissão");
      } else {
        toast.error("Erro ao criar vínculo");
      }
    },
  });
}

export function useDeleteVinculo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("china_submissao_tarefa_vinculos" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-tarefa-vinculos"] });
      queryClient.invalidateQueries({ queryKey: ["china-tarefa-vinculos-all"] });
      toast.success("Vínculo removido");
    },
    onError: () => {
      toast.error("Erro ao remover vínculo");
    },
  });
}
