// Windsor Sync — Fase 1b (por conector: métricas de conta + posts)
// Autorização: admin JWT OU header x-cron-secret == CRON_SECRET.
// Idempotente: upsert em mkt_windsor_map, mkt_contas, mkt_metricas_conta, mkt_posts.
// Preserva branch admin-only { mode: "diagnostico" }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// ---------------- Registro de conectores ----------------
type Conector = {
  slug: string;
  plataforma: "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin" | "x";
  tipo: "organico" | "pago";
  preset: string;
  fieldsConta: string | null;
  fieldsPost: string | null;
  postIdField: string | null;
};

const CONECTORES: Conector[] = [
  {
    slug: "instagram",
    plataforma: "instagram",
    tipo: "organico",
    preset: "last_90d",
    fieldsConta:
      "account_id,account_name,date,reach,impressions,likes,comments,shares,saves,views,profile_views",
    fieldsPost:
      "account_id,account_name,date,media_url,media_product_type,likes,comments,shares,saves,views,reach,timestamp",
    postIdField: "media_url",
  },
  {
    slug: "facebook_organic",
    plataforma: "facebook",
    tipo: "organico",
    preset: "last_90d",
    fieldsConta: null,
    fieldsPost:
      "account_id,account_name,date,post_id,post_type,message,permalink,likes,comments,shares,reactions,views,video_views,clicks,reach,impressions",
    postIdField: "post_id",
  },
  {
    slug: "tiktok_organic",
    plataforma: "tiktok",
    tipo: "organico",
    preset: "last_30d",
    fieldsConta:
      "account_id,account_name,date,likes,comments,shares,video_views,profile_views",
    fieldsPost: null,
    postIdField: null,
  },
];

// ---------------- Diagnóstico (Fase 1a) ----------------
const WINDSOR_FIELDS_DIAG = [
  "source", "account_id", "account_name", "ad_account_id", "account",
  "datasource", "data_source", "connector",
  "campaign_id", "campaign", "date", "spend",
].join(",");

const DIAG_ID_FIELDS = [
  "account_id", "account_name", "ad_account_id", "account", "datasource", "connector",
] as const;

function isNonEmpty(v: unknown): boolean {
  return v != null && String(v).trim() !== "";
}

type WindsorRow = Record<string, unknown>;

function j(cors: HeadersInit, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Coerção numérica: null / "" / NaN → 0
function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function looksLikeLicenseError(text: string): boolean {
  return /license expired|uh-oh/i.test(text);
}

async function fetchConnector(
  slug: string,
  fields: string,
  preset: string,
  apiKey: string,
): Promise<{ ok: true; rows: WindsorRow[] } | { ok: false; status?: number; licenseBlocked?: boolean }> {
  const url = `https://connectors.windsor.ai/${encodeURIComponent(slug)}?api_key=${encodeURIComponent(apiKey)}&fields=${fields}&date_preset=${encodeURIComponent(preset)}&_renderer=json`;
  let r: Response;
  try {
    r = await fetch(url, { method: "GET" });
  } catch (e) {
    console.error("windsor_fetch_failed", slug, e);
    return { ok: false };
  }
  const raw = await r.text().catch(() => "");
  if (!r.ok) {
    if (looksLikeLicenseError(raw)) {
      console.warn("WINDSOR_LICENSE_WARNING", slug, raw.slice(0, 300));
      return { ok: false, status: r.status, licenseBlocked: true };
    }
    console.error("windsor_non_2xx", slug, r.status, raw.slice(0, 1500));
    return { ok: false, status: r.status };
  }
  if (looksLikeLicenseError(raw)) {
    console.warn("WINDSOR_LICENSE_WARNING", slug, raw.slice(0, 300));
    return { ok: false, status: 402, licenseBlocked: true };
  }
  let p: unknown;
  try {
    p = JSON.parse(raw);
  } catch (e) {
    console.error("windsor_json_parse_failed", slug, e);
    return { ok: false };
  }
  if (p && typeof p === "object" && "error" in (p as Record<string, unknown>)) {
    console.error("windsor_payload_error", slug, JSON.stringify(p).slice(0, 1500));
    return { ok: false };
  }
  const rows: WindsorRow[] = Array.isArray(p)
    ? (p as WindsorRow[])
    : Array.isArray((p as { data?: unknown })?.data)
      ? ((p as { data: WindsorRow[] }).data)
      : [];
  return { ok: true, rows };
}


Deno.serve(secureHandler(
  { auth: "none", rateLimit: 5, rateLimitPrefix: "windsor-sync" },
  async (req, _ctx) => {
    const cors = getCorsHeaders(req);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const API_KEY = Deno.env.get("WINDSOR_API_KEY");
    const CRON_SECRET = Deno.env.get("CRON_SECRET");

    if (!API_KEY) return j(cors, 500, { error: "windsor_api_key_missing" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ---------------- Autorização dupla ----------------
    const cronHeader = req.headers.get("x-cron-secret");
    let authorized = false;
    let isCron = false;

    if (CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) {
      authorized = true;
      isCron = true;
    } else {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userRes } = await userClient.auth.getUser();
        const uid = userRes?.user?.id;
        if (uid) {
          const { data: isAdmin } = await admin.rpc("has_role", {
            _user_id: uid,
            _role: "admin",
          });
          if (isAdmin) authorized = true;
        }
      }
    }

    if (!authorized) return j(cors, 403, { error: "forbidden" });

    // ---------------- Modo diagnóstico (admin-only, mantido) ----------------
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    if (!isCron && (body as { mode?: string })?.mode === "diagnostico") {
      async function fetchJanela(preset: string) {
        const url = `https://connectors.windsor.ai/all?api_key=${encodeURIComponent(API_KEY!)}&date_preset=${encodeURIComponent(preset)}&fields=${WINDSOR_FIELDS_DIAG}&_renderer=json`;
        let r: Response;
        try { r = await fetch(url, { method: "GET" }); } catch (e) {
          console.error("windsor_diag_fetch_failed", preset, e);
          return { ok: false as const };
        }
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          console.error("windsor_diag_non_2xx", preset, r.status, t.slice(0, 1500));
          return { ok: false as const, status: r.status };
        }
        const p = await r.json().catch(() => null);
        const rows: WindsorRow[] = Array.isArray(p)
          ? (p as WindsorRow[])
          : Array.isArray((p as { data?: unknown })?.data)
            ? ((p as { data: WindsorRow[] }).data)
            : [];
        return { ok: true as const, rows };
      }
      function resumir(rows: WindsorRow[]) {
        const srcMap = new Map<string, number>();
        const distinct: Record<string, Set<string>> = {};
        for (const f of DIAG_ID_FIELDS) distinct[f] = new Set();
        let semId = 0;
        for (const row of rows) {
          const s = String(row.source ?? "").trim();
          if (s) srcMap.set(s, (srcMap.get(s) ?? 0) + 1);
          if (!isNonEmpty(row.account_id)) semId++;
          for (const f of DIAG_ID_FIELDS) {
            const v = (row as Record<string, unknown>)[f];
            if (isNonEmpty(v)) distinct[f].add(String(v));
          }
        }
        const contagem: Record<string, number> = {};
        for (const f of DIAG_ID_FIELDS) contagem[f] = distinct[f].size;
        return {
          linhas_recebidas: rows.length,
          campos_presentes: rows.length > 0 ? Object.keys(rows[0] as object) : [],
          amostra: rows.slice(0, 3),
          distintos_por_source: Array.from(srcMap.entries())
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count),
          contagem_de_distintos_por_campo: contagem,
          linhas_sem_account_id: semId,
        };
      }
      const janelas: Record<string, unknown> = {};
      for (const preset of ["last_7d", "last_90d"]) {
        const r = await fetchJanela(preset);
        if (!r.ok) return j(cors, 502, { error: "windsor_upstream_error", janela: preset });
        janelas[preset] = resumir(r.rows);
      }
      return j(cors, 200, { modo: "diagnostico", janelas });
    }

    // ---------------- Preload marcas (heurística + fallback) ----------------
    const { data: marcasRows, error: marcasErr } = await admin
      .from("mkt_marcas")
      .select("id, slug");
    if (marcasErr || !marcasRows) {
      console.error("marcas_fetch_failed", marcasErr);
      return j(cors, 500, { error: "marcas_fetch_failed" });
    }
    const marcaBySlug = new Map<string, string>();
    for (const m of marcasRows) marcaBySlug.set(m.slug as string, m.id as string);
    const fallbackId = marcaBySlug.get("nao-atribuido");
    if (!fallbackId) return j(cors, 500, { error: "marca_fallback_missing" });

    // Cache das linhas já existentes de mkt_windsor_map (para respeitar marca_id manual)
    const { data: mapRows } = await admin
      .from("mkt_windsor_map")
      .select("source, windsor_account_id, marca_id");
    const mapMarcaByKey = new Map<string, string | null>();
    for (const r of mapRows ?? []) {
      mapMarcaByKey.set(
        `${r.source}::${r.windsor_account_id}`,
        (r.marca_id as string | null) ?? null,
      );
    }

    function resolverMarca(sourceSlug: string, accountId: string, accountName: string | null): string {
      const key = `${sourceSlug}::${accountId}`;
      const existing = mapMarcaByKey.get(key);
      if (existing) return existing;
      const name = (accountName ?? "").toLowerCase();
      if (/ruby ?rose/.test(name)) return marcaBySlug.get("ruby-rose") ?? fallbackId!;
      if (/\bmelu\b/.test(name)) return marcaBySlug.get("melu") ?? fallbackId!;
      return fallbackId!;
    }

    // ---------------- Laço por conector ----------------
    const por_conector: Array<{ slug: string; contas: number; metricas: number; posts: number; erro?: string }> = [];
    let licenseBlocked = false;

    let totalContas = 0, totalMetricas = 0, totalPosts = 0;

    // Cache de conta_id resolvidas nesta execução
    const contaIdCache = new Map<string, string>(); // marca_id|plataforma|handle -> conta_id

    async function garantirConta(
      marca_id: string,
      plataforma: string,
      handle: string,
      externalId: string | null,
    ): Promise<string | null> {
      const ck = `${marca_id}|${plataforma}|${handle}`;
      const cached = contaIdCache.get(ck);
      if (cached) return cached;
      const { data, error } = await admin
        .from("mkt_contas")
        .upsert(
          { marca_id, plataforma, handle, external_id: externalId, ativo: true },
          { onConflict: "marca_id,plataforma,handle" },
        )
        .select("id")
        .single();
      if (error || !data) {
        console.error("mkt_contas_upsert_failed", ck, error);
        return null;
      }
      contaIdCache.set(ck, data.id as string);
      return data.id as string;
    }

    for (const conector of CONECTORES) {
      let contasCount = 0, metricasCount = 0, postsCount = 0;
      const { slug, plataforma, preset, fieldsConta, fieldsPost, postIdField } = conector;

      // -------- Passo A: métricas de conta --------
      if (fieldsConta) {
        const res = await fetchConnector(slug, fieldsConta, preset, API_KEY);
        if (!res.ok) {
          if (res.licenseBlocked) licenseBlocked = true;
          por_conector.push({ slug, contas: 0, metricas: 0, posts: 0, erro: res.licenseBlocked ? "license_blocked" : "upstream_error" });

          continue;
        }
        const contasParaMap = new Map<string, { handle: string | null }>();
        const metricas: Array<{
          conta_id: string;
          marca_id: string;
          data: string;
          alcance: number;
          impressoes: number;
          engajamento: number;
        }> = [];

        for (const row of res.rows) {
          const account_id = String(row.account_id ?? "").trim();
          if (!account_id) continue;
          const account_name = row.account_name != null ? String(row.account_name) : null;
          const data = row.date != null ? String(row.date).slice(0, 10) : null;
          if (!data) continue;

          contasParaMap.set(account_id, { handle: account_name });
          const marca_id = resolverMarca(slug, account_id, account_name);
          const handle = account_name ?? account_id;
          const conta_id = await garantirConta(marca_id, plataforma, handle, account_id);
          if (!conta_id) continue;
          contasCount++;

          metricas.push({
            conta_id,
            marca_id,
            data,
            alcance: num(row.reach),
            impressoes: num(row.impressions),
            engajamento: num(row.likes) + num(row.comments) + num(row.shares) + num(row.saves),
          });
        }

        if (metricas.length > 0) {
          // dedupe por (conta_id,data): última linha vence
          const dedup = new Map<string, typeof metricas[number]>();
          for (const m of metricas) dedup.set(`${m.conta_id}|${m.data}`, m);
          const arr = Array.from(dedup.values());
          const { error: mErr, count } = await admin
            .from("mkt_metricas_conta")
            .upsert(arr, { onConflict: "conta_id,data", count: "exact" });
          if (mErr) console.error("mkt_metricas_conta_upsert_failed", slug, mErr);
          else metricasCount = count ?? arr.length;
        }

        // Upsert mkt_windsor_map (source = SLUG do conector — NÃO row.source)
        if (contasParaMap.size > 0) {
          const now = new Date().toISOString();
          const mapRowsUpsert = Array.from(contasParaMap.entries()).map(([account_id, v]) => ({
            source: slug,
            windsor_account_id: account_id,
            account_name: v.handle,
            plataforma,
            tipo: conector.tipo,
            ativo: true,
            ultima_vez: now,
          }));
          const { error: mapErr } = await admin
            .from("mkt_windsor_map")
            .upsert(mapRowsUpsert, {
              onConflict: "source,windsor_account_id",
              ignoreDuplicates: false,
            });
          if (mapErr) console.error("mkt_windsor_map_upsert_failed_A", slug, mapErr);
        }
      }

      // -------- Passo B: posts --------
      if (fieldsPost && postIdField) {
        const res = await fetchConnector(slug, fieldsPost, preset, API_KEY);
        if (!res.ok) {
          if (res.licenseBlocked) licenseBlocked = true;
          por_conector.push({ slug, contas: contasCount, metricas: metricasCount, posts: 0, erro: res.licenseBlocked ? "license_blocked" : "upstream_error_posts" });

          continue;
        }

        const contasParaMap = new Map<string, { handle: string | null }>();
        const postsUpsert: Array<{
          conta_id: string;
          marca_id: string;
          external_id: string;
          publicado_em: string | null;
          tipo: string | null;
          permalink: string | null;
          curtidas: number;
          comentarios: number;
          compartilhamentos: number;
          alcance: number;
        }> = [];

        for (const row of res.rows) {
          const account_id = String(row.account_id ?? "").trim();
          if (!account_id) continue;
          const external_id = row[postIdField] != null ? String(row[postIdField]).trim() : "";
          if (!external_id) continue;

          const account_name = row.account_name != null ? String(row.account_name) : null;
          contasParaMap.set(account_id, { handle: account_name });

          const marca_id = resolverMarca(slug, account_id, account_name);
          const handle = account_name ?? account_id;
          const conta_id = await garantirConta(marca_id, plataforma, handle, account_id);
          if (!conta_id) continue;

          const ts = (row.timestamp ?? row.date) as unknown;
          let publicado_em: string | null = null;
          if (ts != null && String(ts).trim() !== "") {
            const s = String(ts);
            const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
            publicado_em = Number.isFinite(d.getTime()) ? d.toISOString() : null;
          }
          const tipoStr = (row.media_product_type ?? row.post_type) as unknown;
          postsUpsert.push({
            conta_id,
            marca_id,
            external_id,
            publicado_em,
            tipo: tipoStr != null ? String(tipoStr) : null,
            permalink: row.permalink != null ? String(row.permalink) : null,
            curtidas: num(row.likes),
            comentarios: num(row.comments),
            compartilhamentos: num(row.shares),
            alcance: num(row.reach),
          });
        }

        if (postsUpsert.length > 0) {
          const dedup = new Map<string, typeof postsUpsert[number]>();
          for (const p of postsUpsert) dedup.set(`${p.conta_id}|${p.external_id}`, p);
          const arr = Array.from(dedup.values());
          const { error: pErr, count } = await admin
            .from("mkt_posts")
            .upsert(arr, { onConflict: "conta_id,external_id", count: "exact" });
          if (pErr) console.error("mkt_posts_upsert_failed", slug, pErr);
          else postsCount = count ?? arr.length;
        }

        // Upsert map (Passo B — quando o conector só tem posts)
        if (contasParaMap.size > 0) {
          const now = new Date().toISOString();
          const mapRowsUpsert = Array.from(contasParaMap.entries()).map(([account_id, v]) => ({
            source: slug,
            windsor_account_id: account_id,
            account_name: v.handle,
            plataforma,
            tipo: conector.tipo,
            ativo: true,
            ultima_vez: now,
          }));
          const { error: mapErr } = await admin
            .from("mkt_windsor_map")
            .upsert(mapRowsUpsert, {
              onConflict: "source,windsor_account_id",
              ignoreDuplicates: false,
            });
          if (mapErr) console.error("mkt_windsor_map_upsert_failed_B", slug, mapErr);
          // Só conta como "contas" descobertas se Passo A não rodou
          if (!fieldsConta) contasCount += contasParaMap.size;
        }
      }

      por_conector.push({ slug, contas: contasCount, metricas: metricasCount, posts: postsCount });
      totalContas += contasCount;
      totalMetricas += metricasCount;
      totalPosts += postsCount;
    }

    return j(cors, 200, {
      por_conector,
      total: { contas: totalContas, metricas: totalMetricas, posts: totalPosts },
      license_blocked: licenseBlocked,
    });

  },
));
