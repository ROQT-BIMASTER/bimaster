// supabase/functions/rrtask-sync-documentos/index.ts
// Push incremental dos documentos do Cofre para a página RR-Tasks já criada.
// Disparado pelo frontend quando o usuário sobe/aprova um doc após o briefing
// ter sido enviado para a agência (briefings.rrtask_page_id != null).
//
// Contrato:
//   request:  { briefing_id: uuid }
//   response: { ok, documentos_sincronizados, documentos_totais }
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  appendDocsToPage,
  buildCofreDocBlocks,
  headingAdicionadoEm,
  loadCofreDocs,
  markDocsEnviados,
} from "../_shared/rrtask-cofre-docs.ts";

const BodySchema = z.object({
  briefing_id: z.string().uuid(),
}).strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "rrtask-sync-documentos" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const J = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        });

      const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return J({ error: parsed.error.flatten() }, 400);
      const { briefing_id } = parsed.data;

      const token = Deno.env.get("HUGGS_RR_TOKEN");
      if (!token) return J({ error: "rr_token_missing" }, 412);

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: b, error: be } = await sb
        .from("briefings")
        .select("id, user_id, rrtask_page_id")
        .eq("id", briefing_id)
        .single();
      if (be || !b) return J({ error: "briefing_not_found" }, 404);

      // owner OR admin
      let allowed = b.user_id === ctx.userId;
      if (!allowed) {
        const { data: adm } = await sb.rpc("has_role", {
          _user_id: ctx.userId,
          _role: "admin",
        });
        allowed = !!adm;
      }
      if (!allowed) return J({ error: "forbidden" }, 403);

      const pageId = b.rrtask_page_id as string | null;
      if (!pageId) return J({ error: "task_not_created" }, 409);

      const docs = await loadCofreDocs(sb, b.id, { onlyNew: true });
      if (!docs.length) {
        return J({ ok: true, documentos_sincronizados: 0, documentos_totais: 0 });
      }

      const blocks = buildCofreDocBlocks(docs, headingAdicionadoEm());
      const r = await appendDocsToPage(token, pageId, blocks);
      if (!r.ok) {
        await sb.from("rrtask_sync_log").insert({
          briefing_id: b.id,
          user_id: ctx.userId,
          action: "error",
          status: "error",
          rrtask_page_id: pageId,
          error_message: `docs_sync: ${r.status} ${r.errorText ?? ""}`.slice(0, 1000),
        });
        return J({ error: "notion_write_failed", detail: r.errorText }, 502);
      }

      const documentos_sincronizados = await markDocsEnviados(sb, docs, pageId);

      await sb.from("rrtask_sync_log").insert({
        briefing_id: b.id,
        user_id: ctx.userId,
        action: "docs_sync",
        status: "success",
        rrtask_page_id: pageId,
      });

      await sb.from("briefings").update({
        rrtask_synced_at: new Date().toISOString(),
      }).eq("id", b.id);

      return J({
        ok: true,
        documentos_sincronizados,
        documentos_totais: docs.length,
      });
    },
  ),
);
