import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VisibilityBlock {
  id: string;
  tipo: string;
  linha: string | null;
  produto_id: string | null;
  motivo: string | null;
  blocked_by: string;
  created_at: string;
}

export function useVisibilityBlocks() {
  const queryClient = useQueryClient();

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["visibility-blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produto_visibility_blocks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as VisibilityBlock[];
    },
  });

  const isProductBlocked = (linha: string | null, produtoId: string): boolean => {
    // Check product-specific block
    if (blocks.some(b => b.tipo === "produto" && b.produto_id === produtoId)) return true;
    // Check line block
    if (linha && blocks.some(b => b.tipo === "linha" && b.linha === linha)) return true;
    return false;
  };

  const isLineBlocked = (linha: string): boolean => {
    return blocks.some(b => b.tipo === "linha" && b.linha === linha);
  };

  const blockMutation = useMutation({
    mutationFn: async (params: { tipo: "linha" | "produto"; linha?: string; produto_id?: string; motivo?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("fabrica_produto_visibility_blocks")
        .insert({
          tipo: params.tipo,
          linha: params.tipo === "linha" ? params.linha : null,
          produto_id: params.tipo === "produto" ? params.produto_id : null,
          motivo: params.motivo || null,
          blocked_by: user.user.id,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visibility-blocks"] });
      toast.success("Bloqueio ativado com sucesso!");
    },
    onError: (error: any) => {
      if (error.message?.includes("unique")) {
        toast.error("Este bloqueio já existe");
      } else {
        toast.error("Erro ao bloquear: " + error.message);
      }
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase
        .from("fabrica_produto_visibility_blocks")
        .delete()
        .eq("id", blockId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visibility-blocks"] });
      toast.success("Bloqueio removido com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao desbloquear: " + error.message);
    },
  });

  const getBlockForProduct = (produtoId: string): VisibilityBlock | undefined => {
    return blocks.find(b => b.tipo === "produto" && b.produto_id === produtoId);
  };

  const getBlockForLine = (linha: string): VisibilityBlock | undefined => {
    return blocks.find(b => b.tipo === "linha" && b.linha === linha);
  };

  return {
    blocks,
    isLoading,
    isProductBlocked,
    isLineBlocked,
    getBlockForProduct,
    getBlockForLine,
    blockProduct: (produtoId: string, motivo?: string) => blockMutation.mutateAsync({ tipo: "produto", produto_id: produtoId, motivo }),
    blockLine: (linha: string, motivo?: string) => blockMutation.mutateAsync({ tipo: "linha", linha, motivo }),
    unblock: (blockId: string) => unblockMutation.mutateAsync(blockId),
    isBlocking: blockMutation.isPending,
    isUnblocking: unblockMutation.isPending,
  };
}
