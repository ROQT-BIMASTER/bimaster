import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useChinaEmbarquesPorOC(ordemId?: string) {
  return useQuery({
    queryKey: ["china-embarques-oc", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_embarques" as any)
        .select("*")
        .eq("ordem_compra_id", ordemId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useEmbarqueItens(embarqueId?: string) {
  return useQuery({
    queryKey: ["china-embarque-itens", embarqueId],
    enabled: !!embarqueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_embarque_itens" as any)
        .select("*, ordem_item:china_ordem_itens(cor_nome, produto_codigo)")
        .eq("embarque_id", embarqueId!);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useCriarEmbarqueParcial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ordem_compra_id: string;
      tipo_embarque: "parcial" | "final" | "unico";
      itens: Array<{ ordem_item_id: string; qty_embarcada: number; lote?: string }>;
      numero_container?: string;
      navio?: string;
      data_embarque?: string;
      data_eta?: string;
      observacoes?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;

      // Calcula numero_embarque sequencial por OC
      const { count } = await supabase
        .from("china_embarques" as any)
        .select("*", { count: "exact", head: true })
        .eq("ordem_compra_id", payload.ordem_compra_id);

      const { data: emb, error: eErr } = await supabase
        .from("china_embarques" as any)
        .insert({
          ordem_compra_id: payload.ordem_compra_id,
          tipo_embarque: payload.tipo_embarque,
          numero_embarque: (count || 0) + 1,
          numero_container: payload.numero_container || null,
          navio: payload.navio || null,
          data_embarque: payload.data_embarque || null,
          data_eta: payload.data_eta || null,
          observacoes: payload.observacoes || null,
          status: "enviado",
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (eErr) throw eErr;

      const linhas = payload.itens
        .filter((i) => i.qty_embarcada > 0)
        .map((i) => ({
          embarque_id: (emb as any).id,
          ordem_item_id: i.ordem_item_id,
          qty_embarcada: i.qty_embarcada,
          lote: i.lote || null,
        }));

      if (linhas.length === 0) throw new Error("Informe ao menos 1 item para embarcar");

      const { error: iErr } = await supabase
        .from("china_embarque_itens" as any)
        .insert(linhas as any);
      if (iErr) throw iErr;

      return emb;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-embarques-oc"] });
      qc.invalidateQueries({ queryKey: ["china-ordem-itens"] });
      qc.invalidateQueries({ queryKey: ["china-ordem"] });
      toast.success("Embarque registrado com sucesso 装运已记录");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar embarque"),
  });
}
