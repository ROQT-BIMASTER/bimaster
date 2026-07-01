// Windsor Sync — Fase 1a (modo descoberta)
// Busca feed all-connectors do Windsor, loga amostras para definir mapeamento
// e faz upsert de contas distintas em mkt_windsor_map. Não grava métricas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const WINDSOR_FIELDS = [
  "source", "account_id", "account_name",
  "campaign_id", "campaign", "objective", "status",
  "date", "clicks", "impressions", "spend", "conversions", "revenue",
  "followers", "reach", "engagement",
  "post_id", "post_message", "likes", "comments", "shares",
  "permalink", "post_type", "published",
].join(",");

type WindsorRow = Record<string, unknown>;

function j(cors: HeadersInit, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function inferTipo(row: WindsorRow): "pago" | "organico" {
  const spend = Number(row.spend);
  if (Number.isFinite(spend) && spend > 0) return "pago";
  if (row.campaign_id != null && String(row.campaign_id).length > 0) return "pago";
  if (row.campaign != null && String(row.campaign).length > 0) return "pago";
  return "organico";
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 5, rateLimitPrefix: "windsor-sync" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const API_KEY = Deno.env.get("WINDSOR_API_KEY");

    if (!API_KEY) {
      return j(cors, 500, { error: "windsor_api_key_missing" });
    }
    if (!ctx.userId) {
      return j(cors, 401, { error: "unauthorized" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Autorização — somente admin
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (roleErr) {
      console.error("has_role_error", roleErr);
      return j(cors, 500, { error: "role_check_failed" });
    }
    if (!isAdmin) {
      return j(cors, 403, { error: "forbidden_admin_only" });
    }

    // Fetch feed
    const url = `https://connectors.windsor.ai/all?api_key=${encodeURIComponent(API_KEY)}&date_preset=last_7d&fields=${WINDSOR_FIELDS}&_renderer=json`;
    let resp: Response;
    try {
      resp = await fetch(url, { method: "GET" });
    } catch (e) {
      console.error("windsor_fetch_failed", e);
      return j(cors, 502, { error: "windsor_upstream_error" });
    }

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      console.error("windsor_non_2xx", resp.status, bodyText.slice(0, 2000));
      return j(cors, 502, { error: "windsor_upstream_error", status: resp.status });
    }

    let payload: unknown;
    try {
      payload = await resp.json();
    } catch (e) {
      console.error("windsor_json_parse_failed", e);
      return j(cors, 502, { error: "windsor_upstream_error" });
    }

    // Windsor pode devolver {data: [...]} ou array direto
    const rows: WindsorRow[] = Array.isArray(payload)
      ? (payload as WindsorRow[])
      : Array.isArray((payload as { data?: unknown })?.data)
        ? ((payload as { data: WindsorRow[] }).data)
        : [];

    // Diagnóstico (só nos logs)
    if (rows.length > 0) {
      console.log("WINDSOR_SAMPLE_ROW", JSON.stringify(rows[0]));
      console.log("WINDSOR_FIELDS", JSON.stringify(Object.keys(rows[0])));
    } else {
      console.log("WINDSOR_SAMPLE_ROW", "(empty)");
      console.log("WINDSOR_FIELDS", "[]");
    }

    const sourceCount = new Map<string, number>();
    const accountsMap = new Map<string, {
      source: string;
      windsor_account_id: string;
      account_name: string | null;
      tipo: "pago" | "organico";
    }>();

    for (const row of rows) {
      const source = String(row.source ?? "").trim();
      const accountId = String(row.account_id ?? "").trim();
      if (!source) continue;
      sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
      if (!accountId) continue;

      const key = `${source}::${accountId}`;
      const existing = accountsMap.get(key);
      const inferredTipo = inferTipo(row);
      // "pago" ganha se qualquer linha da conta parecer paga
      const tipo: "pago" | "organico" =
        existing?.tipo === "pago" || inferredTipo === "pago" ? "pago" : "organico";

      accountsMap.set(key, {
        source,
        windsor_account_id: accountId,
        account_name: (row.account_name != null ? String(row.account_name) : null) ?? existing?.account_name ?? null,
        tipo,
      });
    }

    const sources = Array.from(sourceCount.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
    console.log("WINDSOR_SOURCES", JSON.stringify(sources));

    const accounts = Array.from(accountsMap.values());
    console.log("WINDSOR_ACCOUNTS", JSON.stringify(accounts));

    // Upsert
    let catalogadas = 0;
    if (accounts.length > 0) {
      const now = new Date().toISOString();
      const rowsUpsert = accounts.map((a) => ({
        source: a.source,
        windsor_account_id: a.windsor_account_id,
        account_name: a.account_name,
        tipo: a.tipo,
        ativo: true,
        ultima_vez: now,
      }));

      const { error: upsertErr, count } = await admin
        .from("mkt_windsor_map")
        .upsert(rowsUpsert, {
          onConflict: "source,windsor_account_id",
          ignoreDuplicates: false,
          count: "exact",
        });

      if (upsertErr) {
        console.error("upsert_failed", upsertErr);
        return j(cors, 500, { error: "catalog_upsert_failed" });
      }
      catalogadas = count ?? accounts.length;
    }

    return j(cors, 200, {
      linhas_recebidas: rows.length,
      sources,
      contas_catalogadas: catalogadas,
    });
  },
));
