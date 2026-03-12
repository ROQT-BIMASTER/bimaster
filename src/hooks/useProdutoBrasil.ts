import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProdutoBrasil {
  id: string;
  submissao_china_id: string | null;
  vinculo_id: string | null;
  projeto_id: string | null;
  china_nome: string | null;
  china_codigo: string | null;
  china_ean: string | null;
  china_categoria: string | null;
  china_descricao: string | null;
  nome_brasil: string | null;
  codigo_brasil: string | null;
  categoria_brasil: string | null;
  descricao_brasil: string | null;
  observacoes: string | null;
  status: string;
  responsavel_precadastro_id: string | null;
  responsavel_regulatorio_id: string | null;
  numero_registro: string | null;
  status_anvisa: string | null;
  categoria_regulatoria: string | null;
  responsavel_tecnico: string | null;
  data_aprovacao_regulatorio: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProdutoBrasilSku {
  id: string;
  produto_brasil_id: string;
  cor: string | null;
  cor_hex: string | null;
  tamanho_grade: string | null;
  codigo_interno: string | null;
  ean: string | null;
  quantidade_inicial: number;
  ordem: number;
  foto_url: string | null;
  created_at: string;
}

export interface ProdutoBrasilChecklist {
  id: string;
  produto_brasil_id: string;
  item: string;
  concluido: boolean;
  concluido_por: string | null;
  concluido_em: string | null;
  observacao: string | null;
}

const CHECKLIST_ITEMS = [
  "Conferência de rotulagem",
  "Conferência de composição",
  "Registro ou notificação (se aplicável)",
  "Categoria ANVISA",
  "Tradução e adequação da descrição",
  "Validação de imagens da embalagem",
  "Verificação de obrigatoriedade de lote e validade",
];

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  produto_importado: "Produto Importado da China",
  aguardando_precadastro: "Aguardando Pré-cadastro Brasil",
  precadastro_em_andamento: "Pré-cadastro em Andamento",
  aguardando_regulatorio: "Aguardando Regulatório",
  aprovado_cadastro: "Aprovado para Cadastro",
  produto_ativo: "Produto Ativo no Sistema",
};

export const PRODUCT_STATUS_COLORS: Record<string, string> = {
  produto_importado: "secondary",
  aguardando_precadastro: "warning",
  precadastro_em_andamento: "default",
  aguardando_regulatorio: "warning",
  aprovado_cadastro: "success",
  produto_ativo: "success",
};

// Fetch single produto brasil by ID
export function useProdutoBrasil(id: string | undefined) {
  return useQuery({
    queryKey: ["produto-brasil", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produtos_brasil" as any)
        .select("*")
        .eq("id", id!)
        .single() as any);
      if (error) throw error;
      return data as ProdutoBrasil;
    },
  });
}

// Fetch SKUs for a produto brasil
export function useProdutoBrasilSkus(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["produto-brasil-skus", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_skus" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!)
        .order("ordem")
        .order("created_at") as any);
      if (error) throw error;
      return (data || []) as ProdutoBrasilSku[];
    },
  });
}

// Fetch checklist for a produto brasil
export function useProdutoBrasilChecklist(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["produto-brasil-checklist", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_checklist" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!) as any);
      if (error) throw error;
      return (data || []) as ProdutoBrasilChecklist[];
    },
  });
}

// Create produto brasil with checklist items
export function useCreateProdutoBrasil() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      submissao_china_id?: string;
      vinculo_id?: string;
      projeto_id?: string;
      china_nome: string | null;
      china_codigo: string;
      china_ean?: string;
      china_categoria?: string;
      china_descricao?: string;
      responsavel_precadastro_id?: string;
    }) => {
      // Create produto brasil
      const { data: produto, error } = await (supabase
        .from("produtos_brasil" as any)
        .insert({
          ...params,
          created_by: user?.id || null,
          status: "aguardando_precadastro",
        })
        .select()
        .single() as any);
      if (error) throw error;

      // Populate checklist with standard items
      const checklistInserts = CHECKLIST_ITEMS.map((item) => ({
        produto_brasil_id: produto.id,
        item,
        concluido: false,
      }));
      await (supabase
        .from("produto_brasil_checklist" as any)
        .insert(checklistInserts) as any);

      return produto as ProdutoBrasil;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil"] });
    },
  });
}

// Update produto brasil fields
export function useUpdateProdutoBrasil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProdutoBrasil> & { id: string }) => {
      const { error } = await (supabase
        .from("produtos_brasil" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["produto-brasil"] });
      toast.success("Produto atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar produto");
    },
  });
}

// Toggle checklist item
export function useToggleChecklistItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean; produtoBrasilId: string }) => {
      const { error } = await (supabase
        .from("produto_brasil_checklist" as any)
        .update({
          concluido,
          concluido_por: concluido ? user?.id : null,
          concluido_em: concluido ? new Date().toISOString() : null,
        })
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-checklist", vars.produtoBrasilId] });
    },
  });
}

// CRUD SKUs
export function useAddSku() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { produto_brasil_id: string; cor?: string; cor_hex?: string; tamanho_grade?: string; codigo_interno?: string; ean?: string; quantidade_inicial?: number; ordem?: number; foto_url?: string }) => {
      const { error } = await (supabase
        .from("produto_brasil_skus" as any)
        .insert(params) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-skus", vars.produto_brasil_id] });
      toast.success("SKU adicionado");
    },
  });
}

export function useUpdateSku() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, produtoBrasilId, updates }: { id: string; produtoBrasilId: string; updates: Record<string, any> }) => {
      const { error } = await (supabase
        .from("produto_brasil_skus" as any)
        .update(updates)
        .eq("id", id) as any);
      if (error) throw error;
      return produtoBrasilId;
    },
    onSuccess: (produtoBrasilId) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-skus", produtoBrasilId] });
    },
  });
}

export function useDeleteSku() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, produtoBrasilId }: { id: string; produtoBrasilId: string }) => {
      const { error } = await (supabase
        .from("produto_brasil_skus" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
      return produtoBrasilId;
    },
    onSuccess: (produtoBrasilId) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-skus", produtoBrasilId] });
      toast.success("SKU removido");
    },
  });
}

export function useImportSkusFromChina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ produtoBrasilId, submissaoId }: { produtoBrasilId: string; submissaoId: string }) => {
      // Check existing SKUs
      const { data: existing } = await (supabase
        .from("produto_brasil_skus" as any)
        .select("id")
        .eq("produto_brasil_id", produtoBrasilId)
        .limit(1) as any);

      if (existing && existing.length > 0) {
        toast.info("Grade já importada. Remova os itens existentes para reimportar.");
        return;
      }

      // Get china cores
      const { data: cores, error } = await (supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("ordem") as any);

      if (error) throw error;
      if (!cores || cores.length === 0) {
        toast.info("Nenhuma cor encontrada na submissão China.");
        return;
      }

      const skusToInsert = cores.map((cor: any, i: number) => ({
        produto_brasil_id: produtoBrasilId,
        cor: cor.cor_nome,
        cor_hex: cor.cor_hex || null,
        codigo_interno: cor.codigo_produto || null,
        ean: cor.codigo_barras_ean || null,
        quantidade_inicial: cor.quantidade || 0,
        ordem: i,
        foto_url: cor.foto_url || null,
      }));

      const { error: insertError } = await (supabase
        .from("produto_brasil_skus" as any)
        .insert(skusToInsert) as any);
      if (insertError) throw insertError;

      toast.success(`${skusToInsert.length} variação(ões) importada(s) da China!`);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-skus", vars.produtoBrasilId] });
    },
    onError: () => toast.error("Erro ao importar grade da China"),
  });
}
