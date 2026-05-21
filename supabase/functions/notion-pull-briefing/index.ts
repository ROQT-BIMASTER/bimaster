// supabase/functions/notion-pull-briefing/index.ts
// Pulls properties + the "free zone" from the Notion mirror page back into the
// briefing. Properties update titulo/status/completude; free-zone blocks are
// captured as markdown-ish text into briefing.payload.__notion_notes for the UI.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { listAllChildren, notion, richTextToPlain, type NotionPage } from "../_shared/notion-client.ts";
import { FREE_ZONE_START_LABEL } from "../notion-export-briefing/blocks.ts";

const BodySchema = z.object({ briefing_id: z.string().uuid() }).strict();

function blockToText(b: Record<string, any>): string {
  const t = b.type as string;
  const node = b[t];
  if (!node) return "";
  const text = richTextToPlain(node.rich_text);
  switch (t) {
    case "heading_1": return `# ${text}`;
    case "heading_2": return `## ${text}`;
    case "heading_3": return `### ${text}`;
    case "bulleted_list_item": return `- ${text}`;
    case "numbered_list_item": return `1. ${text}`;
    case "to_do": return `- [${node.checked ? "x" : " "}] ${text}`;
    case "quote": return `> ${text}`;
    case "divider": return "---";
    case "callout": return `> ${text}`;
    case "code": return "```\n" + text + "\n```";
    default: return text;
  }
}

function extractFreeZone(children: Array<Record<string, any>>): string {
  let inZone = false;
  const lines: string[] = [];
  for (const c of children) {
    if (
      c.type === "heading_3" &&
      (c.heading_3?.rich_text?.[0]?.plain_text ?? "").trim() === FREE_ZONE_START_LABEL
    ) {
      inZone = true;
      continue;
    }
    if (!inZone) continue;
    // Stop at the final divider that precedes the bimaster footer
    if (c.type === "divider") break;
    const t = blockToText(c);
    if (t.trim()) lines.push(t);
  }
  return lines.join("\n").trim();
}

function propStringSelect(prop: any): string | null {
  return prop?.select?.name ?? null;
}
function propStringTitle(prop: any): string | null {
  const rt = prop?.title;
  return Array.isArray(rt) && rt.length ? richTextToPlain(rt) : null;
}
function propNumber(prop: any): number | null {
  return typeof prop?.number === "number" ? prop.number : null;
}

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "notion-pull-briefing" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const { briefing_id } = parsed.data;

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: connection } = await sb
        .from("notion_connections")
        .select("access_token")
        .eq("user_id", ctx.userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!connection) {
        return new Response(JSON.stringify({ error: "not_connected" }), {
          status: 412,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: briefing } = await sb
        .from("briefings")
        .select("id, user_id, payload, notion_page_id")
        .eq("id", briefing_id)
        .single();
      if (!briefing || briefing.user_id !== ctx.userId) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (!briefing.notion_page_id) {
        return new Response(JSON.stringify({ error: "no_linked_page" }), {
          status: 412,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const token = connection.access_token as string;

      const pageR = await notion<NotionPage>(token, `/pages/${briefing.notion_page_id}`);
      if (!pageR.ok || !pageR.data) {
        return new Response(JSON.stringify({ error: "page_not_found" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const props = (pageR.data.properties ?? {}) as Record<string, any>;
      const children = await listAllChildren(token, briefing.notion_page_id);
      const notes = extractFreeZone(children);

      const tituloRemote = propStringTitle(props["Título"]);
      const statusRemote = propStringSelect(props["Status"]);
      const completudeRemote = propNumber(props["Completude"]);

      const update: Record<string, unknown> = {};
      const changed: string[] = [];
      if (tituloRemote && tituloRemote !== (briefing as any).titulo) {
        update.titulo = tituloRemote;
        changed.push("titulo");
      }
      if (statusRemote) {
        update.status = statusRemote;
        changed.push("status");
      }
      if (typeof completudeRemote === "number") {
        update.completude = Math.max(0, Math.min(100, Math.round(completudeRemote)));
        changed.push("completude");
      }

      const payload = { ...(briefing.payload as Record<string, unknown> ?? {}) };
      if (notes) {
        payload["__notion_notes"] = notes;
        payload["__notion_notes_pulled_at"] = new Date().toISOString();
        changed.push("__notion_notes");
      }
      update.payload = payload;

      const nowIso = new Date().toISOString();
      update.notion_last_pull_at = nowIso;
      update.notion_synced_at = nowIso;

      await sb.from("briefings").update(update).eq("id", briefing.id);

      await sb.from("briefing_notion_sync_log").insert({
        briefing_id: briefing.id,
        user_id: ctx.userId,
        direction: "pull",
        action: changed.length ? "update" : "noop",
        status: "success",
        notion_page_id: briefing.notion_page_id,
        fields_changed: changed,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          fields_changed: changed,
          notes_chars: notes.length,
          last_edited_time: pageR.data.last_edited_time,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    },
  ),
);
