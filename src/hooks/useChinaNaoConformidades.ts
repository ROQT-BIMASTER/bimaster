import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useNaoConformidades(filtros?: { ordemId?: string; status?: string }) {
  return useQuery({
    queryKey: ["china-nao-conformidades", filtros],
    queryFn: async () => {
      let q = supabase
        .from("china_nao_conformidades" as any)
        .select("*, oc:china_ordens_compra(numero_oc, produto_codigo)")
        .order("created_at", { ascending: false });
      if (filtros?.ordemId) q = q.eq("ordem_compra_id", filtros.ordemId);
      if (filtros?.status) q = q.eq("status", filtros.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useResolverNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      resolucao,
      status,
    }: {
      id: string;
      resolucao: string;
      status: "em_tratativa" | "resolvida" | "cancelada";
    }) => {
      const { error } = await supabase
        .from("china_nao_conformidades" as any)
        .update({
          resolucao,
          status,
          resolvida_em: status === "resolvida" ? new Date().toISOString() : null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-nao-conformidades"] });
      toast.success("Não-conformidade atualizada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar NC"),
  });
}

export function useAbrirNCManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      ordem_compra_id: string;
      tipo: "faltante" | "avariado" | "errado" | "atraso" | "qualidade" | "outro";
      descricao: string;
      qty_envolvida?: number;
      severidade?: "baixa" | "media" | "alta" | "critica";
      ordem_item_id?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("china_nao_conformidades" as any)
        .select("*", { count: "exact", head: true });
      const numero_nc = `NC-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

      const { error } = await supabase.from("china_nao_conformidades" as any).insert({
        numero_nc,
        ordem_compra_id: p.ordem_compra_id,
        ordem_item_id: p.ordem_item_id || null,
        tipo: p.tipo,
        descricao: p.descricao,
        qty_envolvida: p.qty_envolvida || 0,
        severidade: p.severidade || "media",
        status: "aberta",
        aberta_por: user?.id,
        origem_automatica: false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-nao-conformidades"] });
      toast.success("Não-conformidade aberta");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao abrir NC"),
  });
}
