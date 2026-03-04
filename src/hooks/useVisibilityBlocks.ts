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
  launch_date: string | null;
  tabela_id: string | null;
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

  // Active blocks: no launch_date OR launch_date is in the future (product not launched yet)
  const activeBlocks = blocks.filter(b => {
    if (!b.launch_date) return true;
    return new Date(b.launch_date) > new Date();
  });

  const isProductBlocked = (linha: string | null, produtoId: string): boolean => {
    if (activeBlocks.some(b => b.tipo === "produto" && b.produto_id === produtoId)) return true;
    if (linha && activeBlocks.some(b => b.tipo === "linha" && b.linha === linha)) return true;
    return false;
  };

  const isLineBlocked = (linha: string): boolean => {
    return activeBlocks.some(b => b.tipo === "linha" && b.linha === linha);
  };

  const blockMutation = useMutation({
    mutationFn: async (params: { 
      tipo: "linha" | "produto"; 
      linha?: string; 
      produto_id?: string; 
      motivo?: string;
      launch_date?: string | null;
      tabela_id?: string | null;
    }) => {
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
          launch_date: params.launch_date || null,
          tabela_id: params.tabela_id || null,
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
    return activeBlocks.find(b => b.tipo === "produto" && b.produto_id === produtoId);
  };

  const getBlockForLine = (linha: string): VisibilityBlock | undefined => {
    return activeBlocks.find(b => b.tipo === "linha" && b.linha === linha);
  };

  return {
    blocks, // all blocks (for admin listing)
    activeBlocks, // only currently active blocks
    isLoading,
    isProductBlocked,
    isLineBlocked,
    getBlockForProduct,
    getBlockForLine,
    blockProduct: (produtoId: string, motivo?: string, launch_date?: string | null, tabela_id?: string | null) => 
      blockMutation.mutateAsync({ tipo: "produto", produto_id: produtoId, motivo, launch_date, tabela_id }),
    blockLine: (linha: string, motivo?: string, launch_date?: string | null, tabela_id?: string | null) => 
      blockMutation.mutateAsync({ tipo: "linha", linha, motivo, launch_date, tabela_id }),
    blockItem: (params: Parameters<typeof blockMutation.mutateAsync>[0]) => blockMutation.mutateAsync(params),
    unblock: (blockId: string) => unblockMutation.mutateAsync(blockId),
    isBlocking: blockMutation.isPending,
    isUnblocking: unblockMutation.isPending,
  };
}
