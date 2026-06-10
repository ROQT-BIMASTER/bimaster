// Hot indexing: enqueue or inline-embed after writes.
// See RFC v4.0.0 §A2.

import { embedTexts } from "../rag/embed.ts";
import { chunkText } from "../rag/chunk.ts";

const INLINE_THRESHOLD_BYTES = 2 * 1024;

interface SbLike {
  from(t: string): {
    insert(r: any): Promise<{ data: any; error: any }>;
  };
}

export interface IndexEnqueueInput {
  documentId: string;
  content: string;
  priority?: "hot" | "normal";
}

export async function enqueueOrIndexInline(
  sb: SbLike,
  input: IndexEnqueueInput,
): Promise<{ mode: "inline" | "queued" }> {
  const bytes = new TextEncoder().encode(input.content).length;
  if (bytes <= INLINE_THRESHOLD_BYTES) {
    await indexInline(sb, input.documentId, input.content);
    return { mode: "inline" };
  }
  await sb.from("copilot_index_queue").insert({
    document_id: input.documentId,
    priority: input.priority ?? "hot",
  });
  return { mode: "queued" };
}

async function indexInline(sb: SbLike, documentId: string, content: string): Promise<void> {
  const chunks = chunkText(content);
  if (chunks.length === 0) return;
  const vectors = await embedTexts(chunks.map((c) => c.text));
  const rows = chunks.map((c, i) => ({
    document_id: documentId,
    chunk_index: c.index,
    text: c.text,
    embedding: toPgvectorLiteral(vectors[i]),
    metadata: { start: c.startChar, end: c.endChar },
  }));
  await sb.from("copilot_chunks").insert(rows);
}

function toPgvectorLiteral(v: number[]): string {
  // halfvec accepts the same `[a,b,c]` text literal as vector.
  return `[${v.join(",")}]`;
}
