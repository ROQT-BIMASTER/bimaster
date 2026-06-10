// enqueue-doc.ts — thin helper used by every <copilot>-v2 wrapper to push the
// just-produced reply/thread back into the v2 RAG corpus via the service-only
// RPC `enqueue_copilot_document`. Hot-indexer drains it within ~1 min.

interface SbLike {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

export interface EnqueueDocInput {
  copilotId: string;
  sourceType: string;
  sourceRef: string;
  title?: string | null;
  content: string;
  aclScope?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  priority?: "hot" | "normal";
  createdBy?: string | null;
}

/** Best-effort: never throws — indexing failures must not break user reply. */
export async function enqueueCopilotDoc(sb: SbLike, input: EnqueueDocInput): Promise<void> {
  try {
    if (!input.content || input.content.trim().length === 0) return;
    await sb.rpc("enqueue_copilot_document", {
      p_copilot_id: input.copilotId,
      p_source_type: input.sourceType,
      p_source_ref: input.sourceRef,
      p_title: input.title ?? null,
      p_content: input.content,
      p_acl_scope: input.aclScope ?? {},
      p_metadata: input.metadata ?? {},
      p_priority: input.priority ?? "hot",
      p_created_by: input.createdBy ?? null,
    });
  } catch (_e) {
    // swallow — observability via copilot_runs.meta.rag_breach_blocked
  }
}
