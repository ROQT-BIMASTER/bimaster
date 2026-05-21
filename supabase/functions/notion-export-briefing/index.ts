// supabase/functions/notion-export-briefing/index.ts
// Sends a briefing to the user's Notion workspace.
// - Idempotently provisions the "Briefings bimaster" database
// - Patches the database schema if it's missing required properties
// - Creates a page with full canvas mirror
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveBriefingSla } from "../_shared/briefing-sla.ts";
import {
  buildBriefingBlocks,
  buildDatabaseSchema,
  buildPageProperties,
} from "./blocks.ts";

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";
const DATABASE_NAME = "Briefings bimaster";

const BodySchema = z.object({
  briefing_id: z.string().uuid(),
  bimaster_origin: z.string().url().optional(),
}).strict();

interface NotionFetchResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorText?: string;
}

async function notion<T = unknown>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<NotionFetchResult<T>> {
  const resp = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`[notion ${path}] ${resp.status}`, errorText);
    return { ok: false, status: resp.status, data: null, errorText };
  }
  return { ok: true, status: resp.status, data: await resp.json() as T };
}

async function findExistingDatabase(token: string): Promise<{ id: string; url: string } | null> {
  const r = await notion<{ results: Array<{ id: string; url: string; title: Array<{ plain_text: string }> }> }>(
    token,
    "/search",
    {
      method: "POST",
      body: JSON.stringify({
        query: DATABASE_NAME,
        filter: { value: "database", property: "object" },
        page_size: 20,
      }),
    },
  );
  if (!r.ok || !r.data) return null;
  for (const db of r.data.results) {
    const title = db.title?.map((t) => t.plain_text).join("") ?? "";
    if (title.trim().toLowerCase() === DATABASE_NAME.toLowerCase()) {
      return { id: db.id, url: db.url };
    }
  }
  return null;
}

async function findParentPage(token: string): Promise<string | null> {
  const r = await notion<{ results: Array<{ id: string; object: string }> }>(
    token,
    "/search",
    {
      method: "POST",
      body: JSON.stringify({
        filter: { value: "page", property: "object" },
        page_size: 1,
      }),
    },
  );
  if (!r.ok || !r.data?.results?.length) return null;
  return r.data.results[0].id;
}

async function ensureDatabaseSchema(token: string, dbId: string): Promise<void> {
  const r = await notion<{ properties: Record<string, unknown> }>(token, `/databases/${dbId}`);
  if (!r.ok || !r.data) return;
  const existing = new Set(Object.keys(r.data.properties));
  const desired = buildDatabaseSchema();
  const missing: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(desired)) {
    if (key === "Título") continue; // never replace title
    if (!existing.has(key)) missing[key] = def;
  }
  if (Object.keys(missing).length === 0) return;
  await notion(token, `/databases/${dbId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: missing }),
  });
}

async function createDatabase(
  token: string,
  parentPageId: string,
): Promise<{ id: string; url: string } | null> {
  const r = await notion<{ id: string; url: string }>(token, "/databases", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: DATABASE_NAME } }],
      properties: buildDatabaseSchema(),
    }),
  });
  if (!r.ok || !r.data) return null;
  return { id: r.data.id, url: r.data.url };
}

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "notion-export-briefing" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);

      const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: parsed.error.flatten() }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const { briefing_id, bimaster_origin } = parsed.data;

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // 1. Load connection
      const { data: connection, error: connErr } = await sb
        .from("notion_connections")
        .select("*")
        .eq("user_id", ctx.userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (connErr || !connection) {
        return new Response(
          JSON.stringify({ error: "not_connected" }),
          { status: 412, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // 2. Load briefing (owner check)
      const { data: briefing, error: briefingErr } = await sb
        .from("briefings")
        .select("id, user_id, titulo, codigo, tipo, status, completude, payload, projeto_id, template_id, created_at, updated_at")
        .eq("id", briefing_id)
        .single();

      if (briefingErr || !briefing) {
        return new Response(
          JSON.stringify({ error: "briefing_not_found" }),
          { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      if (briefing.user_id !== ctx.userId) {
        return new Response(
          JSON.stringify({ error: "forbidden" }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // 3. Template sections
      let sections: Array<{ key: string; label: string; required?: boolean }> = [];
      if (briefing.template_id) {
        const { data: tpl } = await sb
          .from("briefing_templates")
          .select("sections")
          .eq("id", briefing.template_id)
          .maybeSingle();
        if (tpl?.sections && Array.isArray(tpl.sections)) {
          sections = tpl.sections as typeof sections;
        }
      }
      // Fallback: derive from payload keys
      if (sections.length === 0 && briefing.payload && typeof briefing.payload === "object") {
        sections = Object.keys(briefing.payload as Record<string, unknown>).map((k) => ({
          key: k,
          label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        }));
      }

      // 4. Author + project
      const { data: profile } = await sb
        .from("profiles")
        .select("nome_completo, email")
        .eq("id", briefing.user_id)
        .maybeSingle();

      let projetoNome: string | null = null;
      if (briefing.projeto_id) {
        const { data: proj } = await sb
          .from("projetos")
          .select("nome")
          .eq("id", briefing.projeto_id)
          .maybeSingle();
        projetoNome = proj?.nome ?? null;
      }

      // 5. SLA
      const sla = resolveBriefingSla(briefing.payload);

      // 6. Ensure database exists with full schema
      const token = connection.access_token as string;
      let dbId = connection.briefings_database_id as string | null;
      let dbUrl = connection.briefings_database_url as string | null;

      if (!dbId) {
        const existing = await findExistingDatabase(token);
        if (existing) {
          dbId = existing.id;
          dbUrl = existing.url;
        } else {
          let parentPageId = connection.parent_page_id as string | null;
          if (!parentPageId) parentPageId = await findParentPage(token);
          if (!parentPageId) {
            return new Response(
              JSON.stringify({
                error: "no_accessible_page",
                message:
                  "Compartilhe ao menos uma página com a integração no Notion e tente novamente.",
              }),
              { status: 422, headers: { ...cors, "Content-Type": "application/json" } },
            );
          }
          const created = await createDatabase(token, parentPageId);
          if (!created) {
            return new Response(
              JSON.stringify({ error: "database_create_failed" }),
              { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
            );
          }
          dbId = created.id;
          dbUrl = created.url;
          await sb
            .from("notion_connections")
            .update({ parent_page_id: parentPageId })
            .eq("id", connection.id);
        }
        await sb
          .from("notion_connections")
          .update({
            briefings_database_id: dbId,
            briefings_database_url: dbUrl,
          })
          .eq("id", connection.id);
      }

      await ensureDatabaseSchema(token, dbId!);

      // 7. Build properties + blocks
      const origin = bimaster_origin?.replace(/\/$/, "") || "https://bimaster.lovable.app";
      const blocksInput = {
        briefing: {
          titulo: briefing.titulo,
          codigo: briefing.codigo,
          tipo: briefing.tipo,
          status: briefing.status,
          completude: briefing.completude,
          payload: (briefing.payload ?? {}) as Record<string, unknown>,
          created_at: briefing.created_at,
          updated_at: briefing.updated_at,
        },
        sections,
        projetoNome,
        autorNome: profile?.nome_completo ?? null,
        autorEmail: profile?.email ?? null,
        sla,
        bimasterUrl: `${origin}/dashboard/briefings/${briefing.id}`,
      };

      const properties = buildPageProperties(blocksInput);
      const allBlocks = buildBriefingBlocks(blocksInput);

      // Notion: max 100 blocks per request — first 100 go in create, rest appended
      const firstBatch = allBlocks.slice(0, 100);
      const rest = allBlocks.slice(100);

      const created = await notion<{ id: string; url: string }>(token, "/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties,
          children: firstBatch,
        }),
      });

      if (!created.ok || !created.data) {
        await sb.from("notion_export_log").insert({
          briefing_id: briefing.id,
          user_id: ctx.userId,
          status: "error",
          error_message: `create page: ${created.status} ${created.errorText ?? ""}`.slice(0, 1000),
        });
        return new Response(
          JSON.stringify({ error: "page_create_failed", detail: created.errorText }),
          { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const pageId = created.data.id;
      const pageUrl = created.data.url;

      // Append remaining blocks in chunks of 100
      for (let i = 0; i < rest.length; i += 100) {
        const chunk = rest.slice(i, i + 100);
        const r = await notion(token, `/blocks/${pageId}/children`, {
          method: "PATCH",
          body: JSON.stringify({ children: chunk }),
        });
        if (!r.ok) {
          console.warn("[notion-export-briefing] append chunk failed", r.errorText);
        }
      }

      // 8. Log + bump briefing
      await sb.from("notion_export_log").insert({
        briefing_id: briefing.id,
        user_id: ctx.userId,
        status: "success",
        notion_page_id: pageId,
        notion_page_url: pageUrl,
      });
      await sb
        .from("briefings")
        .update({ ultimo_export_em: new Date().toISOString() })
        .eq("id", briefing.id);

      return new Response(
        JSON.stringify({ ok: true, page_id: pageId, page_url: pageUrl, database_url: dbUrl }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    },
  ),
);
