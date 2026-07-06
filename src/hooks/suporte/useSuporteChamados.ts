import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import type { SuporteChamado, SuporteFila } from "./types";

async function enriquecer(rows: any[]): Promise<SuporteChamado[]> {
  const tickets = (rows ?? []) as SuporteChamado[];
  if (tickets.length === 0) return tickets;

  const filaIds = [...new Set(tickets.map((t) => t.fila_id).filter(Boolean))] as string[];
  const requesterIds = [...new Set(tickets.map((t) => t.requester_id ?? t.owner_id).filter(Boolean))] as string[];

  const [filasRes, dirRes] = await Promise.all([
    filaIds.length
      ? supabase.from("suporte_filas" as any).select("id, nome, slug, cor, icone, ordem, ativo, aceita_chamados, descricao").in("id", filaIds)
      : Promise.resolve({ data: [] } as any),
    requesterIds.length
      ? supabase.rpc("get_chat_directory" as any).then((r: any) => r)
      : Promise.resolve({ data: [] } as any),
  ]);

  const filaMap = new Map<string, SuporteFila>(
    (((filasRes.data ?? []) as unknown) as SuporteFila[]).map((f) => [f.id, f]),
  );
  const dirMap = new Map<string, { id: string; nome: string | null; avatar_url: string | null }>(
    (((dirRes.data ?? []) as unknown) as { id: string; nome: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]),
  );

  return tickets.map((t) => ({
    ...t,
    fila: t.fila_id ? filaMap.get(t.fila_id) ?? null : null,
    requester: dirMap.get(t.requester_id ?? t.owner_id) ?? null,
  }));
}

/** Chamados abertos por mim (visão do solicitante). */
export function useMeusChamados() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["suporte", "meus-chamados", user?.id];

  const query = useQuery({
    queryKey,
    enabled: !!user?.id,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suporte_tickets" as any)
        .select("*")
        .eq("requester_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return enriquecer(data as any[]);
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(uniqueChannelName(`suporte-meus-${user.id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suporte_tickets" },
        () => qc.invalidateQueries({ queryKey: ["suporte", "meus-chamados", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  return query;
}

/** Chamados das filas informadas (visão do agente / desk). */
export function useChamadosDesk(filaIds: string[]) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["suporte", "desk", user?.id, [...filaIds].sort().join(",")];

  const query = useQuery({
    queryKey,
    enabled: !!user?.id && filaIds.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suporte_tickets" as any)
        .select("*")
        .in("fila_id", filaIds)
        .order("ultima_interacao_em", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return enriquecer(data as any[]);
    },
  });

  useEffect(() => {
    if (!user?.id || filaIds.length === 0) return;
    const ch = supabase
      .channel(uniqueChannelName(`suporte-desk-${user.id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suporte_tickets" },
        () => qc.invalidateQueries({ queryKey: ["suporte", "desk"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, filaIds.join(","), qc]);

  return query;
}
