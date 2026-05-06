import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecebimentoAlerta {
  id: string;
  ordem_compra_id: string;
  tipo: "sla_estourado" | "entrega_atrasada";
  severidade: "baixa" | "media" | "alta" | "critica";
  mensagem: string;
  responsavel_id: string | null;
  metadata: any;
  criado_em: string;
  lido_em: string | null;
  resolvido_em: string | null;
}

const KEY = ["china-recebimento-alertas"];

export function useRecebimentoAlertas(opts?: { somenteNaoLidos?: boolean }) {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("china-recebimento-alertas-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_recebimento_alertas" },
        () => qc.invalidateQueries({ queryKey: KEY })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: [...KEY, opts?.somenteNaoLidos ?? false],
    queryFn: async (): Promise<RecebimentoAlerta[]> => {
      let q = supabase
        .from("china_recebimento_alertas" as any)
        .select("*")
        .is("resolvido_em", null)
        .order("criado_em", { ascending: false })
        .limit(200);
      if (opts?.somenteNaoLidos) q = q.is("lido_em", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 15_000,
  });
}

export function useMarcarAlertaLido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("china_recebimento_alertas" as any)
        .update({ lido_em: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
