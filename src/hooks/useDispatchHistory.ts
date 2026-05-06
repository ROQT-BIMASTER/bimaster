import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProcessEventRow {
  id: string;
  process_id: string;
  tipo_evento: string;
  modulo_origem: string;
  descricao: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  metadata: Record<string, any> | null;
  ref_entity_id: string | null;
  ref_entity_table: string | null;
  created_at: string;
}

export const DISPATCH_PAGE_SIZE = 25;

interface Cursor { created_at: string; id: string }
interface Page { rows: ProcessEventRow[]; nextCursor: Cursor | null }

const STORAGE_PREFIX = "dispatch-history-pages:";
const sessionPages = {
  get(submissaoId: string): number {
    try {
      const v = sessionStorage.getItem(STORAGE_PREFIX + submissaoId);
      const n = v ? parseInt(v, 10) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    } catch { return 1; }
  },
  set(submissaoId: string, n: number) {
    try { sessionStorage.setItem(STORAGE_PREFIX + submissaoId, String(n)); } catch { /* ignore */ }
  },
};

async function resolveProcessId(submissaoId: string): Promise<string | null> {
  const { data: proc } = await (supabase
    .from("product_process" as any)
    .select("id")
    .eq("produto_tipo", "china")
    .eq("produto_ref_id", submissaoId)
    .maybeSingle() as any);
  return proc?.id ?? null;
}

/** Compara duas chaves (created_at, id) em ordem decrescente. */
function cmpDesc(a: ProcessEventRow, b: ProcessEventRow): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

/**
 * Insere `incoming` na primeira página, deduplicando contra TODAS as páginas
 * já carregadas e mantendo a ordenação descendente por (created_at, id).
 */
function mergeIncoming(prev: { pages: Page[]; pageParams: any[] } | undefined, incoming: ProcessEventRow[]) {
  if (!prev || prev.pages.length === 0) return prev;
  if (incoming.length === 0) return prev;

  const seen = new Set<string>();
  for (const p of prev.pages) for (const r of p.rows) seen.add(r.id);
  const toAdd = incoming.filter((r) => !seen.has(r.id));
  if (toAdd.length === 0) return prev;

  const [first, ...rest] = prev.pages;
  const merged = [...toAdd, ...first.rows].sort(cmpDesc);
  return { ...prev, pages: [{ ...first, rows: merged }, ...rest] };
}

/**
 * Carrega `process_events` de uma submissão China com:
 *  - paginação por cursor composto (`created_at`, `id`);
 *  - assinatura realtime que **bufferiza** novos eventos e expõe `pendingCount`
 *    + `flushPending()` para o usuário decidir quando atualizar a lista;
 *  - deduplicação contra todas as páginas + reordenação ao mesclar;
 *  - restauração do número de páginas previamente carregadas (sessionStorage).
 */
export function useDispatchHistory(submissaoId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["china-dispatch-history", submissaoId] as const;

  const query = useInfiniteQuery({
    queryKey,
    enabled: !!submissaoId,
    staleTime: 15_000,
    initialPageParam: null as Cursor | null,
    queryFn: async ({ pageParam }): Promise<Page> => {
      if (!submissaoId) return { rows: [], nextCursor: null };
      const pid = await resolveProcessId(submissaoId);
      if (!pid) return { rows: [], nextCursor: null };

      let q = (supabase
        .from("process_events" as any)
        .select("*")
        .eq("process_id", pid)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(DISPATCH_PAGE_SIZE) as any);

      if (pageParam) {
        q = q.or(
          `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`,
        );
      }

      const { data } = await (q as any);
      const rows = (data ?? []) as ProcessEventRow[];
      const last = rows[rows.length - 1];
      const nextCursor = rows.length === DISPATCH_PAGE_SIZE && last
        ? { created_at: last.created_at, id: last.id }
        : null;
      return { rows, nextCursor };
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  // Buffer de eventos recebidos via realtime aguardando flush manual
  const pendingRef = useRef<ProcessEventRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const flushPending = useCallback(() => {
    const buf = pendingRef.current;
    if (buf.length === 0) return;
    pendingRef.current = [];
    setPendingCount(0);
    qc.setQueryData<{ pages: Page[]; pageParams: any[] }>(queryKey, (prev) => mergeIncoming(prev, buf));
  }, [qc, queryKey]);

  // Persiste número de páginas carregadas
  useEffect(() => {
    if (!submissaoId) return;
    const n = query.data?.pages.length ?? 0;
    if (n > 0) sessionPages.set(submissaoId, n);
  }, [submissaoId, query.data?.pages.length]);

  // Restaura páginas anteriores em uma única passada
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!submissaoId || query.isLoading) return;
    if (restoredFor.current === submissaoId) return;
    const target = sessionPages.get(submissaoId);
    const current = query.data?.pages.length ?? 0;
    if (current > 0 && current < target && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    } else if (current >= target || !query.hasNextPage) {
      restoredFor.current = submissaoId;
    }
  }, [submissaoId, query.isLoading, query.data?.pages.length, query.hasNextPage, query.isFetchingNextPage]);

  // Limpa buffer ao trocar de submissão
  useEffect(() => {
    pendingRef.current = [];
    setPendingCount(0);
  }, [submissaoId]);

  // Realtime: bufferiza novos eventos (com dedupe contra páginas + buffer)
  useEffect(() => {
    if (!submissaoId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const pid = await resolveProcessId(submissaoId);
      if (!pid || cancelled) return;
      channel = supabase
        .channel(`dispatch-history:${pid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "process_events", filter: `process_id=eq.${pid}` },
          (payload) => {
            const row = payload.new as ProcessEventRow;
            if (!row?.id) return;

            // Dedupe contra páginas já carregadas
            const cached = qc.getQueryData<{ pages: Page[]; pageParams: any[] }>(queryKey);
            if (cached) {
              for (const p of cached.pages) {
                if (p.rows.some((r) => r.id === row.id)) return;
              }
            }
            // Dedupe contra buffer
            if (pendingRef.current.some((r) => r.id === row.id)) return;

            pendingRef.current = [row, ...pendingRef.current];
            setPendingCount(pendingRef.current.length);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [submissaoId, qc, queryKey]);

  return Object.assign(query, { pendingCount, flushPending });
}
