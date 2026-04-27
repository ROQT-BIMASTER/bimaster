import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProjetoMeta {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao: string | null;
  tipo: "entrega" | "qualidade" | "prazo" | "custo" | "volume";
  valor_alvo: number;
  valor_atual: number;
  unidade: string | null;
  data_inicio: string | null;
  data_alvo: string | null;
  status: "em_andamento" | "em_risco" | "atrasada" | "concluida";
  peso: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type NovaMeta = Omit<
  ProjetoMeta,
  "id" | "created_at" | "updated_at" | "created_by" | "status"
> & {
  status?: ProjetoMeta["status"];
};

export function useProjetoMetas(projetoId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["projeto-metas", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      const { data, error } = await supabase
        .from("projeto_metas" as any)
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoMeta[];
    },
    enabled: !!projetoId,
  });

  const criarMeta = useMutation({
    mutationFn: async (meta: NovaMeta) => {
      const { error } = await supabase
        .from("projeto_metas" as any)
        .insert({ ...meta, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-metas", projetoId] });
      toast.success("Meta criada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const atualizarMeta = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<ProjetoMeta> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_metas" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-metas", projetoId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removerMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projeto_metas" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-metas", projetoId] });
      toast.success("Meta removida");
    },
  });

  // Score ponderado 0-100
  const scoreGlobal = (() => {
    if (!metas.length) return 0;
    const totalPeso = metas.reduce((s, m) => s + (m.peso || 1), 0);
    const somaProgresso = metas.reduce((s, m) => {
      const pct = Math.min(100, (m.valor_atual / (m.valor_alvo || 1)) * 100);
      return s + pct * (m.peso || 1);
    }, 0);
    return Math.round(somaProgresso / Math.max(totalPeso, 1));
  })();

  const stats = (() => {
    const total = metas.length;
    const concluidas = metas.filter((m) => m.status === "concluida").length;
    const atrasadas = metas.filter((m) => m.status === "atrasada").length;
    const emRisco = metas.filter((m) => m.status === "em_risco").length;
    const emAndamento = metas.filter((m) => m.status === "em_andamento").length;
    return { total, concluidas, atrasadas, emRisco, emAndamento };
  })();

  return {
    metas,
    isLoading,
    criarMeta,
    atualizarMeta,
    removerMeta,
    scoreGlobal,
    stats,
  };
}
