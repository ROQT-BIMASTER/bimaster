// supabase/functions/rrtask-create-task/index.ts
// PR-2 — Cria/atualiza a task-mãe no Notion da agência (workspace kilograma.net,
// database RR-Tasks) a partir de um briefing local. Usa o token de integração
// HUGGS_RR_TOKEN (não OAuth por usuário).
//
// PR-B — Snapshot por rodada em `briefing_versoes` + fluxo de devolução:
//   quando o briefing volta como "Devolvido", o reenvio anexa um toggle
//   Round N (sem apagar os anteriores) e bumpa o Round/properties.
//
// Contrato:
//   request:  { briefing_id: uuid, force?: boolean }
//   response: { ok, action: "create"|"update"|"devolucao_resend", page_id,
//               page_url, solicitante_resolvido, warnings[], round? }
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { notion, type NotionPage } from "../_shared/notion-client.ts";
import {
  appendDocsToPage,
  buildCofreDocBlocks,
  headingAdicionadoEm,
  loadCofreDocs,
  markDocsEnviados,
} from "../_shared/rrtask-cofre-docs.ts";

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

/** Monta os blocos internos do briefing (heading_2 + callout ⚠️ semPrazo + parágrafos). */
function montarBlocosBriefing(
  b: { titulo: string | null },
  pl: Record<string, unknown>,
  semPrazo: boolean,
  labelOf: (k: string) => string,
): unknown[] {
  const blocos: unknown[] = [
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: b.titulo ?? "Briefing" } }],
      },
    },
  ];
  if (semPrazo) {
    blocos.push({
      object: "block",
      type: "callout",
      callout: {
        icon: { emoji: "⚠️" },
        rich_text: [{ type: "text", text: { content: "Prazo: A definir" } }],
      },
    });
  }
  for (const [k, v] of Object.entries(pl)) {
    if (v == null || typeof v === "object" || String(v).trim() === "") continue;
    blocos.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: `${labelOf(k)}: ` },
            annotations: { bold: true },
          },
          {
            type: "text",
            text: { content: String(v).slice(0, 1900) },
          },
        ],
      },
    });
  }
  return blocos;
}

/** Envolve os blocos num toggle "💬 Round N (dd/mm/aaaa)". */
function montarToggleRound(round: number, blocos: unknown[]): unknown {
  return {
    object: "block",
    type: "toggle",
    toggle: {
      rich_text: [{
        type: "text",
        text: { content: `💬 Round ${round} (${brDate(new Date().toISOString())})` },
      }],
      children: blocos.slice(0, 100),
    },
  };
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
          "id, user_id, titulo, codigo, tipo, status, completude, payload, template_id, rrtask_page_id, rrtask_page_url, rrtask_round, rrtask_aprovacao",
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
        .select("nome, nome_completo, email")
        .eq("id", b.user_id)
        .maybeSingle();

      const email = (pl.solicitante_email as string | undefined) ?? prof?.email ?? null;
      const nome = (pl.solicitante as string | undefined)
        || (prof as any)?.nome_completo
        || (prof as any)?.nome
        || prof?.email
        || "Desconhecido";

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

      const prazoIso = extrairPrazoISO(
        String(pl.prazo ?? (pl as any).Prazo ?? pl.prazo_entrega ?? ""),
      );
      let semPrazo = false;
      if (prazoIso) {
        props["Prazo"] = { date: { start: prazoIso } };
      } else {
        semPrazo = true;
      }

      const blob = Object.values(pl).filter((v) => typeof v === "string").join("  ");

      const marca = ["Ruby Rose", "Melu", "Union"].find((mk) =>
        new RegExp(mk, "i").test(blob)
      );
      if (marca) props["Marca"] = { multi_select: [{ name: marca }] };

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
      } else {
        const skuM = blob.match(/\b(HB|RR)[\s\-]?(\d{3,})\b/i);
        if (skuM) {
          props["SKU"] = {
            rich_text: [{
              text: { content: `${skuM[1].toUpperCase()}-${skuM[2]}` },
            }],
          };
        }
      }

      // 6. Load template sections (for labelOf)
      let secoes: Array<{ key: string; label: string }> = [];
      if (b.template_id) {
        const { data: tpl } = await sb
          .from("briefing_templates")
          .select("secoes")
          .eq("id", b.template_id)
          .maybeSingle();
        if (Array.isArray((tpl as any)?.secoes)) {
          secoes = (tpl as any).secoes as Array<{ key: string; label: string }>;
        }
      }
      const labelOf = (k: string) =>
        secoes.find((s) => s.key === k)?.label ?? k;

      // 7. Idempotency: probe existing page
      let action: "create" | "update" | "devolucao_resend" = "create";
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
          action = b.rrtask_aprovacao === "Devolvido" ? "devolucao_resend" : "update";
        }
      }

      // 8. Write to Notion — três caminhos
      if (action === "create") {
        // CREATE: page nova com toggle Round 1 (briefing + docs do cofre)
        const blocosR1 = montarBlocosBriefing(b, pl, semPrazo, labelOf);
        const cofreDocsCreate = await loadCofreDocs(sb, b.id, { onlyNew: false });
        const cofreBlocksCreate = buildCofreDocBlocks(
          cofreDocsCreate,
          "Documentos do Cofre",
        );
        const toggleR1 = montarToggleRound(1, [...blocosR1, ...cofreBlocksCreate]);
        const resp = await notion<{ id: string; url: string }>(token, "/pages", {
          method: "POST",
          body: JSON.stringify({
            parent: { database_id: RR_TASKS_DB_ID },
            properties: props,
            children: [toggleR1],
          }),
        });
        if (!resp.ok || !resp.data) {
          await sb.from("rrtask_sync_log").insert({
            briefing_id: b.id,
            user_id: ctx.userId,
            action: "error",
            status: "error",
            error_message: `create: ${resp.status} ${resp.errorText ?? ""}`.slice(0, 1000),
          });
          return J({ error: "notion_write_failed", detail: resp.errorText }, 502);
        }
        pageId = resp.data.id;
        pageUrl = resp.data.url ?? pageUrl;

        const documentos_sincronizados = await markDocsEnviados(
          sb,
          cofreDocsCreate,
          pageId,
        );

        await sb.from("briefings").update({
          rrtask_page_id: pageId,
          rrtask_page_url: pageUrl,
          rrtask_synced_at: new Date().toISOString(),
        }).eq("id", b.id);

        await sb.from("briefing_versoes").insert({
          briefing_id: b.id,
          round: 1,
          origem: "envio",
          payload_snapshot: pl,
          body_md: null,
          rrtask_page_id: pageId,
          enviado_por: ctx.userId,
        });

        await sb.from("rrtask_sync_log").insert({
          briefing_id: b.id,
          user_id: ctx.userId,
          action: "create",
          status: "success",
          rrtask_page_id: pageId,
          solicitante_resolvido: solicitanteResolvido,
        });

        return J({
          ok: true,
          action: "create",
          page_id: pageId,
          page_url: pageUrl,
          solicitante_resolvido: solicitanteResolvido,
          documentos_sincronizados,
          documentos_totais: cofreDocsCreate.length,
          warnings,
        });
      }

      if (action === "devolucao_resend") {
        // DEVOLUÇÃO: anexa toggle Round N + bumpa Round/Aprovação
        const novoRound = (b.rrtask_round ?? 1) + 1;
        const blocos = montarBlocosBriefing(b, pl, semPrazo, labelOf);
        const cofreDocsRound = await loadCofreDocs(sb, b.id, { onlyNew: true });
        const cofreBlocksRound = buildCofreDocBlocks(
          cofreDocsRound,
          `Documentos novos do Round ${novoRound}`,
        );
        const toggle = montarToggleRound(novoRound, [...blocos, ...cofreBlocksRound]);

        // 8a. Append toggle aos children da página (não apaga anteriores)
        const append = await notion(token, `/blocks/${pageId}/children`, {
          method: "PATCH",
          body: JSON.stringify({ children: [toggle] }),
        });
        if (!append.ok) {
          await sb.from("rrtask_sync_log").insert({
            briefing_id: b.id,
            user_id: ctx.userId,
            action: "error",
            status: "error",
            error_message:
              `devolucao_resend/append: ${append.status} ${append.errorText ?? ""}`.slice(0, 1000),
          });
          return J({ error: "notion_write_failed", detail: append.errorText }, 502);
        }

        // 8b. Bumpa properties (Round + volta pra Pendente)
        const patch = await notion(token, `/pages/${pageId}`, {
          method: "PATCH",
          body: JSON.stringify({
            properties: {
              "Round": { number: novoRound },
              "Aprovação de Conteúdo": { select: { name: "Pendente" } },
            },
          }),
        });
        if (!patch.ok) {
          await sb.from("rrtask_sync_log").insert({
            briefing_id: b.id,
            user_id: ctx.userId,
            action: "error",
            status: "error",
            error_message:
              `devolucao_resend/props: ${patch.status} ${patch.errorText ?? ""}`.slice(0, 1000),
          });
          return J({ error: "notion_write_failed", detail: patch.errorText }, 502);
        }

        // 8c. Espelho local + versão + log
        const documentos_sincronizados = await markDocsEnviados(
          sb,
          cofreDocsRound,
          pageId!,
        );

        await sb.from("briefings").update({
          rrtask_round: novoRound,
          rrtask_aprovacao: "Pendente",
          rrtask_synced_at: new Date().toISOString(),
        }).eq("id", b.id);

        await sb.from("briefing_versoes").insert({
          briefing_id: b.id,
          round: novoRound,
          origem: "revisao",
          payload_snapshot: pl,
          body_md: null,
          motivo_devolucao: null,
          rrtask_page_id: pageId,
          enviado_por: ctx.userId,
        });

        await sb.from("rrtask_sync_log").insert({
          briefing_id: b.id,
          user_id: ctx.userId,
          action: "devolucao_resend",
          status: "success",
          rrtask_page_id: pageId,
          solicitante_resolvido: solicitanteResolvido,
        });

        return J({
          ok: true,
          action: "devolucao_resend",
          round: novoRound,
          page_id: pageId,
          page_url: pageUrl,
          solicitante_resolvido: solicitanteResolvido,
          documentos_sincronizados,
          documentos_totais: cofreDocsRound.length,
          warnings,
        });
      }

      // UPDATE normal (reenvio/force fora de devolução): re-PATCH só properties
      const resp = await notion<{ id: string; url: string }>(token, `/pages/${pageId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: props }),
      });
      if (!resp.ok || !resp.data) {
        await sb.from("rrtask_sync_log").insert({
          briefing_id: b.id,
          user_id: ctx.userId,
          action: "error",
          status: "error",
          error_message: `update: ${resp.status} ${resp.errorText ?? ""}`.slice(0, 1000),
        });
        return J({ error: "notion_write_failed", detail: resp.errorText }, 502);
      }
      pageId = resp.data.id;
      pageUrl = resp.data.url ?? pageUrl;

      await sb.from("briefings").update({
        rrtask_page_id: pageId,
        rrtask_page_url: pageUrl,
        rrtask_synced_at: new Date().toISOString(),
      }).eq("id", b.id);

      await sb.from("rrtask_sync_log").insert({
        briefing_id: b.id,
        user_id: ctx.userId,
        action: "update",
        status: "success",
        rrtask_page_id: pageId,
        solicitante_resolvido: solicitanteResolvido,
      });

      return J({
        ok: true,
        action: "update",
        page_id: pageId,
        page_url: pageUrl,
        solicitante_resolvido: solicitanteResolvido,
        warnings,
      });
    },
  ),
);
