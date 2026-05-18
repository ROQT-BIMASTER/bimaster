/**
 * usePresenceStatus — status declarado de presença (Disponível/Ocupado/...)
 *
 * 2 hooks:
 *  - useMyPresenceStatus: status do user atual + setStatus (upsert)
 *  - usePresenceStatusMap(ids): mapa { userId → status } pra renderizar
 *    bolinhas em listas de avatares. Realtime sub atualiza ao mudar.
 */
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { toast } from "sonner";

export type PresenceStatus =
  | "disponivel"
  | "ocupado"
  | "em_reuniao"
  | "ausente"
  | "nao_perturbe";

export interface PresenceStatusRow {
  user_id: string;
  status: PresenceStatus;
  mensagem: string | null;
  updated_at: string;
}

/** Definições visuais por status — usadas em StatusPicker e na bolinha do avatar. */
export const PRESENCE_STATUS_INFO: Record<PresenceStatus, {
  label: string;
  color: string;       // bg
  ringColor: string;   // ring para destacar
  textColor: string;
}> = {
  disponivel:  { label: "Disponível",  color: "bg-emerald-500",  ringColor: "ring-emerald-500/30",  textColor: "text-emerald-700 dark:text-emerald-400" },
  ocupado:     { label: "Ocupado",     color: "bg-red-500",      ringColor: "ring-red-500/30",      textColor: "text-red-700 dark:text-red-400" },
  em_reuniao:  { label: "Em reunião",  color: "bg-amber-500",    ringColor: "ring-amber-500/30",    textColor: "text-amber-700 dark:text-amber-400" },
  ausente:     { label: "Ausente",     color: "bg-slate-400",    ringColor: "ring-slate-400/30",    textColor: "text-slate-600 dark:text-slate-400" },
  nao_perturbe:{ label: "Não perturbe",color: "bg-rose-700",     ringColor: "ring-rose-700/30",     textColor: "text-rose-700 dark:text-rose-400" },
};

export const PRESENCE_STATUS_OPTIONS: PresenceStatus[] = [
  "disponivel", "ocupado", "em_reuniao", "ausente", "nao_perturbe",
];

export function useMyPresenceStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  const queryKey = ["presence-status-self", userId];

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<PresenceStatusRow | null> => {
      if (!userId) return null;
      const { data } = await supabase
        .from("user_presence_status" as any)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return (data as unknown as PresenceStatusRow) ?? null;
    },
  });

  // Realtime: outro device do mesmo user pode ter trocado o status
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(uniqueChannelName(`presence-self-${userId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence_status", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const setStatus = useMutation({
    mutationFn: async (args: { status: PresenceStatus; mensagem?: string }) => {
      if (!userId) throw new Error("não autenticado");
      const { error } = await supabase
        .from("user_presence_status" as any)
        .upsert({
          user_id: userId,
          status: args.status,
          mensagem: args.mensagem ?? null,
        }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error("Erro ao atualizar status: " + (e?.message ?? "")),
  });

  return { ...query, setStatus };
}

/**
 * usePresenceStatusMap — mapa userId → status pra um conjunto de ids.
 * Usa um único subscribe na tabela inteira e invalida ao mudar.
 */
export function usePresenceStatusMap(userIds: string[]) {
  const qc = useQueryClient();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const idsKey = ids.slice().sort().join(",");
  const queryKey = ["presence-status-map", idsKey];

  const query = useQuery({
    queryKey,
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, PresenceStatusRow>> => {
      if (!ids.length) return new Map();
      const { data } = await supabase
        .from("user_presence_status" as any)
        .select("*")
        .in("user_id", ids);
      const map = new Map<string, PresenceStatusRow>();
      (data ?? []).forEach((r: any) => map.set(r.user_id, r));
      return map;
    },
  });

  // Realtime — invalida quando qualquer status mudar (não filtra por ids
  // pra simplicidade; o stale-time evita refetch desnecessário)
  useEffect(() => {
    if (!ids.length) return;
    const ch = supabase
      .channel(uniqueChannelName(`presence-map`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence_status" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, qc]);

  return query;
}
