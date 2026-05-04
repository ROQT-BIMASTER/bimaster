import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HistoricoEntry {
  id: string;
  item_id: string;
  user_id: string | null;
  user_nome?: string | null;
  acao: string;
  origem: string;
  coluna_origem: string | null;
  coluna_destino: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  etapa_anterior_nome: string | null;
  etapa_atual_nome: string | null;
  comentario: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface HistoricoFilters {
  acao?: string; // "todos" or specific action
  dataDe?: string; // YYYY-MM-DD
  dataAte?: string; // YYYY-MM-DD
  ordem?: "desc" | "asc";
}

export const HISTORICO_PAGE_SIZE = 30;

export const useItemHistorico = (
  itemId: string | null | undefined,
  filters: HistoricoFilters = {},
) => {
  const { acao, dataDe, dataAte, ordem = "desc" } = filters;

  return useInfiniteQuery<HistoricoEntry[], Error, HistoricoEntry[], any[], number>({
    queryKey: ["item-historico", itemId, { acao, dataDe, dataAte, ordem }],
    enabled: !!itemId,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < HISTORICO_PAGE_SIZE) return undefined;
      return allPages.length;
    },
    queryFn: async ({ pageParam }): Promise<HistoricoEntry[]> => {
      const page = pageParam as number;
      const from = page * HISTORICO_PAGE_SIZE;
      const to = from + HISTORICO_PAGE_SIZE - 1;

      let q = supabase
        .from("aprovacao_kanban_audit" as any)
        .select("*")
        .eq("item_id", itemId as string)
        .order("created_at", { ascending: ordem === "asc" })
        .range(from, to);

      if (acao && acao !== "todos") q = q.eq("acao", acao);
      if (dataDe) q = q.gte("created_at", `${dataDe}T00:00:00`);
      if (dataAte) q = q.lte("created_at", `${dataAte}T23:59:59`);

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];

      const userIds = Array.from(
        new Set(rows.map((r) => r.user_id).filter(Boolean)),
      ) as string[];
      let nomes: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        nomes = Object.fromEntries(
          (profs ?? []).map((p: any) => [p.id, p.full_name || p.email || "—"]),
        );
      }
      return rows.map((r) => ({
        ...r,
        user_nome: r.user_id ? nomes[r.user_id] ?? null : null,
      })) as HistoricoEntry[];
    },
  });
};

export const useComentarItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      comentario,
    }: {
      itemId: string;
      comentario: string;
    }) => {
      const { data, error } = await supabase.rpc(
        "rpc_comentar_item_aprovacao" as any,
        { p_item_id: itemId, p_comentario: comentario },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["item-historico", vars.itemId] });
      qc.invalidateQueries({
        queryKey: ["item-aprovacao-auditoria", vars.itemId],
      });
    },
  });
}
