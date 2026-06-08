/**
 * useCofreProdutoPastas — lista e cria pastas/coleções do Cofre por produto.
 * Permite organizar documentos promovidos do chat por equipe (departamento).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CofrePasta {
  id: string;
  produto_id: string;
  nome: string;
  descricao: string | null;
  departamento_id: string | null;
  cor: string | null;
  criado_por: string | null;
  created_at: string;
  departamento?: { id: string; nome: string } | null;
}

export function useCofreProdutoPastas(produtoId?: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const pastasQuery = useQuery({
    queryKey: ["cofre-produto-pastas", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cofre_produto_pastas" as any)
        .select("id, produto_id, nome, descricao, departamento_id, cor, criado_por, created_at, departamento:departamentos(id, nome)")
        .eq("produto_id", produtoId!)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CofrePasta[];
    },
  });

  const createPasta = useMutation({
    mutationFn: async (input: {
      nome: string;
      descricao?: string | null;
      departamento_id?: string | null;
      cor?: string | null;
    }) => {
      if (!produtoId) throw new Error("Produto não informado.");
      const nome = input.nome.trim();
      if (!nome) throw new Error("Informe o nome da pasta.");

      const { data, error } = await supabase
        .from("cofre_produto_pastas" as any)
        .insert({
          produto_id: produtoId,
          nome,
          descricao: input.descricao ?? null,
          departamento_id: input.departamento_id ?? null,
          cor: input.cor ?? null,
          criado_por: user!.id,
        } as any)
        .select("id, produto_id, nome, descricao, departamento_id, cor, criado_por, created_at")
        .single();
      if (error) throw error;
      return data as unknown as CofrePasta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofre-produto-pastas", produtoId] });
      toast.success("Pasta criada.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao criar pasta."),
  });

  return { pastasQuery, createPasta };
}

export function useDepartamentosOptions() {
  return useQuery({
    queryKey: ["departamentos-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamentos")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Departamento (equipe) do usuário logado — usado para filtrar
 * automaticamente as pastas do Cofre relevantes para a equipe.
 */
export function useMeuDepartamento() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["meu-departamento", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", user!.id)
        .maybeSingle();
      const departamentoId = profile?.departamento_id ?? null;
      if (!departamentoId) return { id: null as string | null, nome: null as string | null };
      const { data: dept } = await supabase
        .from("departamentos")
        .select("id, nome")
        .eq("id", departamentoId)
        .maybeSingle();
      return { id: dept?.id ?? null, nome: dept?.nome ?? null };
    },
  });
}

