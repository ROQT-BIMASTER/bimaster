// Edge Function: rr-sync
// PR-3b — Sincroniza RR-Linhas / RR-Produtos / RR-Variantes (Notion da agência)
// para as tabelas-espelho rr_linhas / rr_produtos / rr_variantes.
//
// - Agendada via pg_cron horário (0 * * * *).
// - Protegida por header `x-cron-secret`, comparado (timingSafeEqual) ao valor
//   lido do vault via RPC SECURITY DEFINER `public._get_rrtask_cron_secret`
//   — mesmo mecanismo do rrtask-poll-status.
// - Token Notion: HUGGS_RR_TOKEN.
// - Escreve em rr_sync_log (banco / upserts / status / error_message) em cada bloco.
import { createClient } from "npm:@supabase/supabase-js@2";
import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { notion } from "../_shared/notion-client.ts";

const DB = {
  produtos:  "372b20a2-47b7-811e-9f44-e3ba46fc44d4",
  linhas:    "372b20a2-47b7-81e1-bf5e-c9117040da67",
  variantes: "372b20a2-47b7-8135-a43c-d1db1b133819",
};

const WF = [
  "Briefing","Primária","Etiqueta Bula","Etiqueta Fundo","Etiqueta Provador",
  "Etiqueta Display","Display","Provador","QR Code","Desenho Técnico",
  "Caixa Master","Aprovação Licenciador",
];

// ---------- Property accessors ----------
type Prop = Record<string, unknown> | null | undefined;
const txt = (p: Prop) =>
  ((p as { rich_text?: { plain_text?: string }[] })?.rich_text ?? [])
    .map((x) => x.plain_text ?? "").join("") || null;
const ttl = (p: Prop) =>
  ((p as { title?: { plain_text?: string }[] })?.title ?? [])
    .map((x) => x.plain_text ?? "").join("") || null;
const sel = (p: Prop) =>
  (p as { select?: { name?: string } } | null)?.select?.name ?? null;
const sta = (p: Prop) =>
  (p as { status?: { name?: string } } | null)?.status?.name ?? null;
const ms = (p: Prop) =>
  ((p as { multi_select?: { name?: string }[] })?.multi_select ?? [])
    .map((x) => x.name ?? "").filter(Boolean);
const dt = (p: Prop) =>
  (p as { date?: { start?: string } } | null)?.date?.start ?? null;
const rel1 = (p: Prop) =>
  (p as { relation?: { id?: string }[] } | null)?.relation?.[0]?.id ?? null;

const rollNum = (p: Prop): number | null => {
  const r = (p as { rollup?: { type?: string; number?: number; array?: Array<{ type?: string; number?: number }> } })?.rollup;
  if (!r) return null;
  if (r.type === "number") return r.number ?? null;
  if (r.type === "array") {
    const n = r.array?.find((a) => a.type === "number");
    return n?.number ?? null;
  }
  return null;
};

const rollStr = (p: Prop): string | null => {
  const r = (p as { rollup?: { type?: string; array?: Array<{ type?: string; select?: { name?: string }; rich_text?: { plain_text?: string }[] }> } })?.rollup;
  if (r?.type === "array") {
    const s = (r.array ?? []).map((a) =>
      a.type === "select"
        ? (a.select?.name ?? "")
        : a.type === "rich_text"
          ? (a.rich_text ?? []).map((x) => x.plain_text ?? "").join("")
          : ""
    ).filter(Boolean).join(", ");
    return s || null;
  }
  return null;
};

// ---------- Notion DB pagination ----------
interface NotionPg {
  id: string;
  properties?: Record<string, unknown>;
}
async function fetchAll(token: string, dbId: string): Promise<NotionPg[]> {
  const out: NotionPg[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 200; i++) { // guard
    const r = await notion<{ results: NotionPg[]; has_more: boolean; next_cursor: string | null }>(
      token,
      `/databases/${dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
      },
    );
    if (!r.ok || !r.data) break;
    out.push(...(r.data.results ?? []));
    if (!r.data.has_more || !r.data.next_cursor) break;
    cursor = r.data.next_cursor;
  }
  return out;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 30, rateLimitPrefix: "rr-sync" },
  async (req) => {
    const cors = getCorsHeaders(req);
    const J = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: x-cron-secret vs vault (RPC) — idêntico ao rrtask-poll-status
    const provided = req.headers.get("x-cron-secret") ?? "";
    const { data: expected, error: vaultErr } = await admin.rpc("_get_rrtask_cron_secret");
    if (vaultErr || !expected || !provided) return J({ ok: false, error: "forbidden" }, 403);
    const enc = new TextEncoder();
    const a = enc.encode(provided);
    const b = enc.encode(expected as string);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return J({ ok: false, error: "forbidden" }, 403);
    }

    const token = Deno.env.get("HUGGS_RR_TOKEN");
    if (!token) return J({ ok: false, error: "rr_token_missing" }, 412);

    const now = new Date().toISOString();
    const result: Record<string, unknown> = {};

    // ----- LINHAS -----
    try {
      const pages = await fetchAll(token, DB.linhas);
      const rows = pages.map((pg) => {
        const P = (pg.properties ?? {}) as Record<string, Prop>;
        return {
          notion_page_id: pg.id,
          nome: ttl(P["Nome"]),
          marca: sel(P["Marca"]),
          status: sta(P["Status"]),
          fabricante: txt(P["Fabricante"]),
          cnpj_fabricante: txt(P["CNPJ Fabricante"]),
          afe_fabricante: txt(P["AFE Fabricante"]),
          selos: ms(P["Selos"]),
          origem: sel(P["Origem"]),
          publico_alvo: txt(P["Público-alvo"]),
          sac: txt(P["SAC"]),
          pct_composicao: rollNum(P["% c/ Composição"]),
          pct_ean: rollNum(P["% c/ EAN Base"]),
          pct_anvisa: rollNum(P["% c/ Anvisa"]),
          raw: P,
          synced_at: now,
        };
      });
      if (rows.length) {
        const { error } = await admin.from("rr_linhas").upsert(rows, { onConflict: "notion_page_id" });
        if (error) throw new Error(error.message);
      }
      await admin.from("rr_sync_log").insert({ banco: "linhas", upserts: rows.length, status: "success" });
      result.linhas = rows.length;
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      await admin.from("rr_sync_log").insert({ banco: "linhas", status: "error", error_message: msg.slice(0, 500) });
      result.linhas_error = msg;
    }

    // ----- PRODUTOS -----
    try {
      const pages = await fetchAll(token, DB.produtos);
      const rows = pages.map((pg) => {
        const P = (pg.properties ?? {}) as Record<string, Prop>;
        const wf: Record<string, string | null> = {};
        for (const f of WF) wf[f] = sel(P[`WF ${f}`]);
        return {
          notion_page_id: pg.id,
          sku: txt(P["SKU"]),
          nome_comercial: ttl(P["Nome Comercial"]),
          marca: rollStr(P["Marca"]),
          categoria: sel(P["Categoria"]),
          status: sta(P["Status"]),
          composicao_pt: !!txt(P["Composição PT"]),
          composicao_en: !!txt(P["Composição EN"]),
          anvisa: txt(P["Nº Processo Anvisa"]),
          linha_notion_id: rel1(P["Linha"]),
          ultima_revisao_regulatoria: dt(P["Última Revisão Regulatória"]),
          wf,
          raw: P,
          synced_at: now,
        };
      });
      if (rows.length) {
        const { error } = await admin.from("rr_produtos").upsert(rows, { onConflict: "notion_page_id" });
        if (error) throw new Error(error.message);
      }
      await admin.from("rr_sync_log").insert({ banco: "produtos", upserts: rows.length, status: "success" });
      result.produtos = rows.length;
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      await admin.from("rr_sync_log").insert({ banco: "produtos", status: "error", error_message: msg.slice(0, 500) });
      result.produtos_error = msg;
    }

    // ----- VARIANTES -----
    try {
      const pages = await fetchAll(token, DB.variantes);
      const rows = pages.map((pg) => {
        const P = (pg.properties ?? {}) as Record<string, Prop>;
        return {
          notion_page_id: pg.id,
          nome_tom: ttl(P["Nome do Tom"]),
          sku_individual: txt(P["SKU Individual"]),
          codigo_tom: txt(P["Código do Tom"]),
          pantone: txt(P["Pantone"]),
          ean_unitario: txt(P["EAN Unitário"]),
          ean_provador: txt(P["EAN Provador"]),
          status: sel(P["Status"]),
          produto_notion_id: rel1(P["Produto"]),
          raw: P,
          synced_at: now,
        };
      });
      if (rows.length) {
        const { error } = await admin.from("rr_variantes").upsert(rows, { onConflict: "notion_page_id" });
        if (error) throw new Error(error.message);
      }
      await admin.from("rr_sync_log").insert({ banco: "variantes", upserts: rows.length, status: "success" });
      result.variantes = rows.length;
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      await admin.from("rr_sync_log").insert({ banco: "variantes", status: "error", error_message: msg.slice(0, 500) });
      result.variantes_error = msg;
    }

    return J({ ok: true, ...result });
  },
));
