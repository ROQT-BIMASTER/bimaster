import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type SyncAlvo = "pedidos" | "historico" | "contas_pagar";

export interface SyncControlRubysp {
  id: number;
  ultima_exec_pedidos: string | null;
  ultima_exec_historico: string | null;
  ultima_exec_contas_pagar: string | null;
  status_pedidos: string | null;
  status_historico: string | null;
  status_contas_pagar: string | null;
  mensagem_pedidos: string | null;
  mensagem_historico: string | null;
  solicitado_pedidos_em: string | null;
  solicitado_historico_em: string | null;
  solicitar_contas_pagar_em: string | null;
}

const QUERY_KEY = ["sync-control-rubysp"] as const;

export function useSyncControlRubysp() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<SyncControlRubysp | null> => {
      const { data, error } = await supabase
        .from("sync_control_rubysp" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const mutation = useMutation({
    mutationFn: async (alvo: SyncAlvo) => {
      const { error } = await supabase.rpc("solicitar_sync_rubysp" as any, { p_alvo: alvo });
      if (error) throw error;
      return alvo;
    },
    onMutate: async (alvo: SyncAlvo) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<SyncControlRubysp | null>(QUERY_KEY);
      if (prev) {
        const next: SyncControlRubysp = {
          ...prev,
          ...(alvo === "pedidos"
            ? { status_pedidos: "rodando", solicitado_pedidos_em: new Date().toISOString() }
            : { status_historico: "rodando", solicitado_historico_em: new Date().toISOString() }),
        };
        qc.setQueryData(QUERY_KEY, next);
      }
      return { prev };
    },
    onSuccess: () => {
      toast.success("Solicitado — o sincronizador roda em até 1 minuto");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err: any, _alvo, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error(err?.message ?? "Não foi possível solicitar a sincronização");
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    solicitarSync: (alvo: SyncAlvo) => mutation.mutate(alvo),
    isSyncing: mutation.isPending,
    syncingAlvo: mutation.isPending ? (mutation.variables as SyncAlvo | undefined) : undefined,
  };
}
