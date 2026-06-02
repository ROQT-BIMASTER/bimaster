// supabase/functions/rrtask-create-task/index.ts
// PR-2 — Cria/atualiza a task-mãe no Notion da agência (workspace kilograma.net,
// database RR-Tasks) a partir de um briefing local. Usa o token de integração
// HUGGS_RR_TOKEN (não OAuth por usuário).
//
// Contrato:
//   request:  { briefing_id: uuid, force?: boolean }
//   response: { ok, action: "create"|"update", page_id, page_url,
//               solicitante_resolvido, warnings[] }
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { notion, type NotionPage } from "../_shared/notion-client.ts";

const RR_TASKS_DB_ID = "372b20a2-47b7-819f-9f50-e264014848b4";

const TIPO_ENTREGA_MAP: Record<string, string> = {
  embalagem: "Embalagem/produto",
  pdv: "Trade-PDV",
  ecommerce: "E-commerce",
  catalogo: "Catálogo",
  campanha: "Social",
  presskit: "Apresentação",
  material_interno: "Outro",
  evento: "Outro",
};
const MARCAS = new Set(["Ruby Rose", "Melu", "Union"]);

const BodySchema = z.object({
  briefing_id: z.string().uuid(),
  force: z.boolean().optional().default(false),
}).strict();

function brDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function extrairPrazoISO(texto: string): string | null {
  if (!texto) return null;
  let m = texto.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = texto.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "rrtask-create-task" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const J = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        });

      const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return J({ error: parsed.error.flatten() }, 400);
      const { briefing_id, force } = parsed.data;

      const token = Deno.env.get("HUGGS_RR_TOKEN");
      if (!token) return J({ error: "rr_token_missing" }, 412);

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // 1. Load briefing
      const { data: b, error: be } = await sb
        .from("briefings")
        .select(
          "id, user_id, titulo, codigo, tipo, status, completude, payload, rrtask_page_id, rrtask_page_url, rrtask_round",
        )
        .eq("id", briefing_id)
        .single();
      if (be || !b) return J({ error: "briefing_not_found" }, 404);

      // 2. Authorization: owner OR admin
      let allowed = b.user_id === ctx.userId;
      if (!allowed) {
        const { data: adm } = await sb.rpc("has_role", {
          _user_id: ctx.userId,
          _role: "admin",
        });
        allowed = !!adm;
      }
      if (!allowed) return J({ error: "forbidden" }, 403);

      // 3. Completude guard
      if ((b.completude ?? 0) < 100 && !force) {
        return J({ error: "briefing_nao_pronto", completude: b.completude }, 409);
      }

      const pl = (b.payload ?? {}) as Record<string, unknown>;
      const warnings: string[] = [];

      // 4. Resolve solicitante
      const { data: prof } = await sb
        .from("profiles")
        .select("nome_completo, email")
        .eq("id", b.user_id)
        .maybeSingle();

      const email = (pl.solicitante_email as string | undefined) ?? prof?.email ?? null;
      const nome = (pl.solicitante as string | undefined) ?? prof?.nome_completo ?? "Desconhecido";

      let area: string | null = null;
      let notionUserId: string | null = null;
      if (email) {
        const { data: m } = await sb
          .from("rr_solicitante_map")
          .select("notion_user_id, area_solicitante")
          .eq("email", email)
          .eq("ativo", true)
          .maybeSingle();
        if (m) {
          area = (m.area_solicitante as string | null) ?? null;
          notionUserId = (m.notion_user_id as string | null) ?? null;
        }
      }
      const solicitanteResolvido = !!notionUserId;
      if (!solicitanteResolvido) {
        warnings.push(
          "Solicitante gravado como texto legado (user_id Notion indisponível).",
        );
      }

      // 5. Build properties (schema v3 — nomes EXATOS com acentos)
      const props: Record<string, unknown> = {
        "Nome do Pedido": {
          title: [{
            text: {
              content: `[HUGGS-${b.codigo ?? b.id.slice(0, 8)}] ${b.titulo ?? "Sem título"}`
                .slice(0, 2000),
            },
          }],
        },
        "Status": { status: { name: "Backlog" } },
        "Etapa": { select: { name: "Briefing" } },
        "Aprovação de Conteúdo": { select: { name: "Pendente" } },
        "Round": { number: 1 },
      };

      const tipoKey = String(pl.demand_type ?? b.tipo ?? "").toLowerCase();
      const tipoEntrega = TIPO_ENTREGA_MAP[tipoKey] ?? "Outro";
      if (!TIPO_ENTREGA_MAP[tipoKey]) {
        warnings.push(`Tipo '${tipoKey}' sem de-para — usado 'Outro'.`);
      }
      props["Tipo de entrega"] = { select: { name: tipoEntrega } };

      const prazo = (pl.prazo as string | undefined) ?? (pl.prazo_entrega as string | undefined);
      let semPrazo = false;
      if (prazo && /^\d{4}-\d{2}-\d{2}/.test(String(prazo))) {
        props["Prazo"] = {
          date: { start: String(prazo).slice(0, 10) },
        };
      } else {
        semPrazo = true;
      }

      if (pl.marca && MARCAS.has(String(pl.marca))) {
        props["Marca"] = { multi_select: [{ name: String(pl.marca) }] };
      }
      const colcamp = (pl.colecao as string | undefined) ?? (pl.campanha as string | undefined);
      if (colcamp) {
        props["Coleção/Campanha"] = { multi_select: [{ name: String(colcamp) }] };
      }
      if (area) props["Área solicitante"] = { select: { name: area } };
      if (solicitanteResolvido) {
        props["Solicitante"] = { people: [{ object: "user", id: notionUserId }] };
      } else {
        props["zz_Solicitante (legado texto)"] = {
          rich_text: [{ text: { content: String(nome).slice(0, 2000) } }],
        };
      }
      if (pl.sku) {
        props["SKU"] = { rich_text: [{ text: { content: String(pl.sku).slice(0, 2000) } }] };
      }

      // 6. Build body (toggle Round 1)
      const innerBlocks: unknown[] = [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: b.titulo ?? "Briefing" } }],
          },
        },
      ];
      if (semPrazo) {
        innerBlocks.push({
          object: "block",
          type: "callout",
          callout: {
            icon: { emoji: "⚠️" },
            rich_text: [{ type: "text", text: { content: "Prazo: A definir" } }],
          },
        });
      }
      for (const [k, v] of Object.entries(pl)) {
        if (v == null || typeof v === "object") continue;
        innerBlocks.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{
              type: "text",
              text: { content: `${k}: ${String(v)}`.slice(0, 1900) },
            }],
          },
        });
      }

      const toggle = {
        object: "block",
        type: "toggle",
        toggle: {
          rich_text: [{
            type: "text",
            text: { content: `💬 Round 1 (${brDate(new Date().toISOString())})` },
          }],
          children: innerBlocks.slice(0, 100),
        },
      };

      // 7. Idempotency: probe existing page
      let action: "create" | "update" = "create";
      let pageId = (b.rrtask_page_id as string | null) ?? null;
      let pageUrl = (b.rrtask_page_url as string | null) ?? null;

      if (pageId) {
        const probe = await notion<NotionPage>(token, `/pages/${pageId}`);
        if (!probe.ok || !probe.data || probe.data.archived || probe.data.in_trash) {
          console.log(
            `[rrtask-create-task] linked page ${pageId} gone (${probe.status}) — recreating`,
          );
          pageId = null;
          pageUrl = null;
        } else {
          action = "update";
        }
      }

      // 8. Write to Notion
      const resp = action === "create"
        ? await notion<{ id: string; url: string }>(token, "/pages", {
          method: "POST",
          body: JSON.stringify({
            parent: { database_id: RR_TASKS_DB_ID },
            properties: props,
            children: [toggle],
          }),
        })
        : await notion<{ id: string; url: string }>(token, `/pages/${pageId}`, {
          method: "PATCH",
          body: JSON.stringify({ properties: props }),
        });

      if (!resp.ok || !resp.data) {
        await sb.from("rrtask_sync_log").insert({
          briefing_id: b.id,
          user_id: ctx.userId,
          action: "error",
          status: "error",
          error_message: `${action}: ${resp.status} ${resp.errorText ?? ""}`.slice(0, 1000),
        });
        return J({ error: "notion_write_failed", detail: resp.errorText }, 502);
      }

      pageId = resp.data.id;
      pageUrl = resp.data.url ?? pageUrl;

      // 9. Persist + log
      await sb
        .from("briefings")
        .update({
          rrtask_page_id: pageId,
          rrtask_page_url: pageUrl,
          rrtask_synced_at: new Date().toISOString(),
        })
        .eq("id", b.id);

      await sb.from("rrtask_sync_log").insert({
        briefing_id: b.id,
        user_id: ctx.userId,
        action,
        status: "success",
        rrtask_page_id: pageId,
        solicitante_resolvido: solicitanteResolvido,
      });

      return J({
        ok: true,
        action,
        page_id: pageId,
        page_url: pageUrl,
        solicitante_resolvido: solicitanteResolvido,
        warnings,
      });
    },
  ),
);
