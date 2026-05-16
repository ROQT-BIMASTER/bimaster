// china-backfill-translations — percorre tabelas do módulo China e completa
// label_pt/label_cn/label_en faltantes usando a edge function de tradução
// (que já tem cache global). Processa em lotes de 30 itens por tabela.
//
// Retorna relatório: { processados, traduzidos, cacheHits, falhas, demoraMs }.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const BodySchema = z.object({
  scopes: z.array(z.enum([
    "templates",
    "custom_categorias",
    "custom_itens",
    "cat_overrides",
  ])).optional(),
  submissaoId: z.string().uuid().optional(),
}).strict();

const BATCH = 30;
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/china-translate-labels`;

interface Counters { processados: number; traduzidos: number; cacheHits: number; falhas: number }

async function translateBatch(
  authHeader: string,
  items: Array<{ id: string; pt?: string | null; cn?: string | null; en?: string | null }>,
  context: string,
  submissaoId?: string,
  entidade?: string,
): Promise<{ items: any[]; meta: any } | null> {
  try {
    const r = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        items: items.map(i => ({ id: i.id, pt: i.pt || "", cn: i.cn || "", en: i.en || "" })),
        context,
        submissaoId,
        entidade,
      }),
    });
    if (!r.ok) {
      await r.text();
      return null;
    }
    return await r.json();
  } catch (e) {
    console.warn("[backfill] translate batch fail", e);
    return null;
  }
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 5, rateLimitPrefix: "china-backfill-translations" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const t0 = Date.now();

    let raw: unknown = {};
    try { raw = await req.json(); } catch { /* empty body OK */ }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const scopes = parsed.data.scopes ?? ["templates", "custom_categorias", "custom_itens", "cat_overrides"];

    const authHeader = req.headers.get("authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const counters: Counters = { processados: 0, traduzidos: 0, cacheHits: 0, falhas: 0 };

    // 1) Templates globais — label_cn / label_en
    if (scopes.includes("templates")) {
      const { data } = await sb
        .from("china_doc_checklist_templates")
        .select("id, label_pt, label_cn, label_en")
        .or("label_cn.is.null,label_en.is.null,label_cn.eq.,label_en.eq.")
        .limit(500);
      for (let i = 0; i < (data?.length ?? 0); i += BATCH) {
        const slice = (data || []).slice(i, i + BATCH);
        const items = slice.map((r: any) => ({ id: r.id, pt: r.label_pt, cn: r.label_cn, en: r.label_en }));
        const res = await translateBatch(authHeader, items, "checklist-template", undefined, "template");
        counters.processados += slice.length;
        if (!res?.items) { counters.falhas += slice.length; continue; }
        counters.cacheHits += res.meta?.cacheHits ?? 0;
        counters.falhas += res.meta?.failures ?? 0;
        for (const r of res.items) {
          const orig = slice.find((s: any) => s.id === r.id);
          if (!orig) continue;
          const upd: any = {};
          if (!orig.label_pt && r.pt) upd.label_pt = r.pt;
          if (!orig.label_cn && r.cn) upd.label_cn = r.cn;
          if (!orig.label_en && r.en) upd.label_en = r.en;
          if (Object.keys(upd).length === 0) continue;
          const { error } = await sb.from("china_doc_checklist_templates").update(upd).eq("id", r.id);
          if (!error) counters.traduzidos++;
        }
      }
    }

    // 2) Categorias custom
    if (scopes.includes("custom_categorias")) {
      let q = sb.from("china_checklist_custom_categorias")
        .select("id, label_pt, label_cn, label_en, submissao_id")
        .or("label_cn.is.null,label_en.is.null,label_cn.eq.,label_en.eq.")
        .limit(500);
      if (parsed.data.submissaoId) q = q.eq("submissao_id", parsed.data.submissaoId);
      const { data } = await q;
      for (let i = 0; i < (data?.length ?? 0); i += BATCH) {
        const slice = (data || []).slice(i, i + BATCH);
        const items = slice.map((r: any) => ({ id: r.id, pt: r.label_pt, cn: r.label_cn, en: r.label_en }));
        const res = await translateBatch(authHeader, items, "checklist-categoria", parsed.data.submissaoId, "categoria");
        counters.processados += slice.length;
        if (!res?.items) { counters.falhas += slice.length; continue; }
        counters.cacheHits += res.meta?.cacheHits ?? 0;
        counters.falhas += res.meta?.failures ?? 0;
        for (const r of res.items) {
          const orig = slice.find((s: any) => s.id === r.id);
          if (!orig) continue;
          const upd: any = {};
          if (!orig.label_pt && r.pt) upd.label_pt = r.pt;
          if (!orig.label_cn && r.cn) upd.label_cn = r.cn;
          if (!orig.label_en && r.en) upd.label_en = r.en;
          if (Object.keys(upd).length === 0) continue;
          const { error } = await sb.from("china_checklist_custom_categorias").update(upd).eq("id", r.id);
          if (!error) counters.traduzidos++;
        }
      }
    }

    // 3) Itens custom
    if (scopes.includes("custom_itens")) {
      let q = sb.from("china_checklist_custom_itens")
        .select("id, label_pt, label_cn, label_en, submissao_id")
        .or("label_cn.is.null,label_en.is.null,label_cn.eq.,label_en.eq.")
        .limit(500);
      if (parsed.data.submissaoId) q = q.eq("submissao_id", parsed.data.submissaoId);
      const { data } = await q;
      for (let i = 0; i < (data?.length ?? 0); i += BATCH) {
        const slice = (data || []).slice(i, i + BATCH);
        const items = slice.map((r: any) => ({ id: r.id, pt: r.label_pt, cn: r.label_cn, en: r.label_en }));
        const res = await translateBatch(authHeader, items, "checklist-item", parsed.data.submissaoId, "item");
        counters.processados += slice.length;
        if (!res?.items) { counters.falhas += slice.length; continue; }
        counters.cacheHits += res.meta?.cacheHits ?? 0;
        counters.falhas += res.meta?.failures ?? 0;
        for (const r of res.items) {
          const orig = slice.find((s: any) => s.id === r.id);
          if (!orig) continue;
          const upd: any = {};
          if (!orig.label_pt && r.pt) upd.label_pt = r.pt;
          if (!orig.label_cn && r.cn) upd.label_cn = r.cn;
          if (!orig.label_en && r.en) upd.label_en = r.en;
          if (Object.keys(upd).length === 0) continue;
          const { error } = await sb.from("china_checklist_custom_itens").update(upd).eq("id", r.id);
          if (!error) counters.traduzidos++;
        }
      }
    }

    // 4) Overrides de categoria padrão
    if (scopes.includes("cat_overrides")) {
      let q = sb.from("china_checklist_cat_overrides")
        .select("categoria_key, submissao_id, label_pt, label_cn")
        .or("label_cn.is.null,label_cn.eq.")
        .limit(500);
      if (parsed.data.submissaoId) q = q.eq("submissao_id", parsed.data.submissaoId);
      const { data } = await q;
      for (let i = 0; i < (data?.length ?? 0); i += BATCH) {
        const slice = (data || []).slice(i, i + BATCH);
        const items = slice.map((r: any) => ({ id: `${r.submissao_id}__${r.categoria_key}`, pt: r.label_pt, cn: r.label_cn }));
        const res = await translateBatch(authHeader, items, "checklist-cat-override", parsed.data.submissaoId, "cat_override");
        counters.processados += slice.length;
        if (!res?.items) { counters.falhas += slice.length; continue; }
        counters.cacheHits += res.meta?.cacheHits ?? 0;
        counters.falhas += res.meta?.failures ?? 0;
        for (const r of res.items) {
          const [submissaoId, categoriaKey] = String(r.id).split("__");
          const orig = slice.find((s: any) => s.submissao_id === submissaoId && s.categoria_key === categoriaKey);
          if (!orig) continue;
          const upd: any = {};
          if (!orig.label_pt && r.pt) upd.label_pt = r.pt;
          if (!orig.label_cn && r.cn) upd.label_cn = r.cn;
          if (Object.keys(upd).length === 0) continue;
          const { error } = await sb.from("china_checklist_cat_overrides")
            .update(upd).eq("submissao_id", submissaoId).eq("categoria_key", categoriaKey);
          if (!error) counters.traduzidos++;
        }
      }
    }

    return new Response(JSON.stringify({ ...counters, demoraMs: Date.now() - t0 }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  },
));
