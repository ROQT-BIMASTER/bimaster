// Retrieval with ACL revalidation (belt & suspenders). See RFC v4.0.0 §A2.
//
// 1) Vector match via SECURITY DEFINER RPC `match_copilot_chunks`.
// 2) Backend re-validates `docId` access for each returned chunk via
//    `assertDocAccess` — chunks failing revalidation are dropped and
//    logged as RAG_ACL_BREACH_BLOCKED (target = 0).

import { embedOne } from "./embed.ts";

export interface RetrievedChunk {
  chunkId: string;
  docId: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
  freshness?: "indexed" | "live";
}

export interface RetrieveOptions {
  topK?: number;
  copilotId?: string;
  filters?: Record<string, unknown>;
}

export interface SupabaseLike {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): { maybeSingle(): Promise<{ data: unknown; error: unknown }> };
    };
  };
}

export type AccessChecker = (docId: string, userId: string) => Promise<boolean>;

export interface RetrieveDeps {
  supabase: SupabaseLike;
  userId: string;
  assertDocAccess: AccessChecker;
  /** Logger for ACL breach attempts. Must never throw. */
  logBreach?: (info: { docId: string; chunkId: string; reason: string }) => void;
}

export async function retrieve(
  query: string,
  deps: RetrieveDeps,
  opts: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? 20;
  const embedding = await embedOne(query);
  const { data, error } = await deps.supabase.rpc("match_copilot_chunks", {
    query_embedding: embedding,
    match_count: topK,
    p_copilot_id: opts.copilotId ?? null,
    p_user_id: deps.userId,
    p_filters: opts.filters ?? {},
  });
  if (error) throw new Error(`match_copilot_chunks failed: ${JSON.stringify(error)}`);
  const rows = (data as Array<{
    chunk_id: string;
    doc_id: string;
    text: string;
    score: number;
    metadata: Record<string, unknown> | null;
  }>) ?? [];

  const out: RetrievedChunk[] = [];
  for (const r of rows) {
    const ok = await deps.assertDocAccess(r.doc_id, deps.userId).catch(() => false);
    if (!ok) {
      deps.logBreach?.({ docId: r.doc_id, chunkId: r.chunk_id, reason: "revalidation_failed" });
      continue;
    }
    out.push({
      chunkId: r.chunk_id,
      docId: r.doc_id,
      text: r.text,
      score: r.score,
      metadata: r.metadata ?? undefined,
      freshness: "indexed",
    });
  }
  // Re-rank: cap to topK/2.5 (~8 when topK=20)
  return out.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.ceil(topK / 2.5)));
}
