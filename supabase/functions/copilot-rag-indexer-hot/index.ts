// Hot indexing worker — drains copilot_index_queue priority='hot' first.
// Designed for cron (1min) AND direct invocation after execute_* writes.

import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { embedTexts } from "../_shared/rag/embed.ts";
import { chunkText } from "../_shared/rag/chunk.ts";

const BATCH = 10;

Deno.serve(
  secureHandler(
    { auth: "any", rateLimit: 60, rateLimitPrefix: "copilot-rag-indexer-hot" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Claim up to BATCH pending items, hot first.
      const { data: queued, error: qErr } = await sb
        .from("copilot_index_queue")
        .select("id, document_id, priority, attempts")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(BATCH);
      if (qErr) {
        return new Response(JSON.stringify({ error: qErr.message }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const processed: Array<{ id: string; mode: string; chunks?: number; error?: string }> = [];
      for (const item of queued ?? []) {
        await sb
          .from("copilot_index_queue")
          .update({ status: "processing", attempts: (item.attempts ?? 0) + 1 })
          .eq("id", item.id);
        try {
          const { data: doc, error: dErr } = await sb
            .from("copilot_documents")
            .select("id, content")
            .eq("id", item.document_id)
            .maybeSingle();
          if (dErr || !doc) throw new Error(dErr?.message ?? "document not found");

          await sb.from("copilot_chunks").delete().eq("document_id", doc.id);
          const chunks = chunkText(doc.content);
          if (chunks.length > 0) {
            const vectors = await embedTexts(chunks.map((c) => c.text));
            const rows = chunks.map((c, i) => ({
              document_id: doc.id,
              chunk_index: c.index,
              text: c.text,
              embedding: `[${vectors[i].join(",")}]`,
              metadata: { start: c.startChar, end: c.endChar },
            }));
            const { error: iErr } = await sb.from("copilot_chunks").insert(rows);
            if (iErr) throw new Error(iErr.message);
          }
          await sb.from("copilot_index_queue").update({ status: "done" }).eq("id", item.id);
          processed.push({ id: item.id, mode: "indexed", chunks: chunks.length });
        } catch (e) {
          await sb
            .from("copilot_index_queue")
            .update({ status: "error", last_error: String(e instanceof Error ? e.message : e) })
            .eq("id", item.id);
          processed.push({ id: item.id, mode: "error", error: String(e) });
        }
      }

      return new Response(JSON.stringify({ processed }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    },
  ),
);
