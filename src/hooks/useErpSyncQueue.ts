import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type SyncTable = "fornecedores" | "contas_pagar" | "parcelas" | "pagamentos";

interface SyncPayload {
  tabela: SyncTable;
  operacao: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
}

async function enqueueSync({ tabela, operacao, payload }: SyncPayload) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("erp_sync_log" as any).insert({
    tabela,
    operacao,
    entity_type: tabela,
    entity_id: (payload as any).id ?? null,
    action: operacao,
    direction: "outbound",
    request_payload: payload,
    sync_status: "pendente",
    tentativas: 0,
    success: false,
    created_by: user?.id ?? null,
  });
}

/**
 * Hook that subscribes to Realtime changes on AP tables
 * and enqueues sync records in erp_sync_log.
 * Mount once at app level (e.g., inside authenticated layout).
 */
export function useErpSyncQueue() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const tables: SyncTable[] = ["fornecedores", "contas_pagar", "parcelas", "pagamentos"];

    const channel = supabase.channel("erp-sync-queue");

    for (const table of tables) {
      channel.on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table },
        (p: any) => enqueueSync({ tabela: table, operacao: "insert", payload: p.new })
      );
      channel.on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table },
        (p: any) => enqueueSync({ tabela: table, operacao: "update", payload: p.new })
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      mounted.current = false;
    };
  }, []);
}
