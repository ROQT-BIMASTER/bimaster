import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProdutoBrasilHistorico {
  id: string;
  produto_brasil_id: string;
  tipo: string;
  descricao: string | null;
  user_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export const HISTORICO_ICONS: Record<string, string> = {
  produto_criado: "📦",
  status_alterado: "🔄",
  projeto_vinculado: "🔗",
  foto_adicionada: "📷",
  fotos_china_importadas: "📷",
  cadastro_atualizado: "✏️",
  enviado_regulatorio: "📤",
  aprovado: "✅",
};

export function useProdutoBrasilHistorico(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["produto-brasil-historico", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_historico" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as ProdutoBrasilHistorico[];
    },
  });
}

export function useAddHistorico() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      produtoBrasilId,
      tipo,
      descricao,
      metadata = {},
    }: {
      produtoBrasilId: string;
      tipo: string;
      descricao: string;
      metadata?: Record<string, any>;
    }) => {
      const { error } = await (supabase
        .from("produto_brasil_historico" as any)
        .insert({
          produto_brasil_id: produtoBrasilId,
          tipo,
          descricao,
          user_id: user?.id || null,
          metadata,
        }) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-historico", vars.produtoBrasilId] });
    },
  });
}
