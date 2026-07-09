// Feed de produtos para o iPaper (Enrichment Automation / Auto Update).
// Substitui a planilha manual "ESTOQUE CATALOGOS IPAPER PADRÃO.xlsx":
// junta ipaper_produtos (de-para ID iPaper <-> CODHB + preço/embalagem)
// com erp_estoque_live — o saldo DISPONÍVEL do força de vendas do Result
// (mesmo número que o vendedor vê), sincronizado pelo erp-sync-engine.
// Auth: token compartilhado (?token= ou Bearer) — o iPaper busca a URL sem JWT.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { buildIpaperRows } from "../_shared/ipaper-data.ts";

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "ipaper-feed", skipWaf: true },
  async (req) => {
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

    const expected = Deno.env.get("IPAPER_FEED_TOKEN");
    if (!expected) return json(500, { error: "server_misconfigured" });

    const url = new URL(req.url);
    // Só aceita o token via header Authorization: Bearer <token>.
    // ?token= foi removido: credenciais em query string aparecem em logs
    // (edge/CDN/proxy) e podem vazar via Referer.
    const authHeader = req.headers.get("Authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!provided || !constantTimeEquals(provided, expected)) {
      return json(401, { error: "unauthorized" });
    }


    const format = url.searchParams.get("format") ?? "csv";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
      const linhas = await buildIpaperRows(supabase);

      const commonHeaders = {
        ...cors,
        "Cache-Control": "public, max-age=300",
      };

      if (format === "json") {
        return new Response(JSON.stringify(linhas), {
          headers: { ...commonHeaders, "Content-Type": "application/json" },
        });
      }

      const header = "ID,NAME,STOCK,DESCRIPTION,CODHB,PRICE,PACKAGE SIZE";
      const body = linhas
        .map((l) =>
          [l.ID, l.NAME, l.STOCK, l.DESCRIPTION, l.CODHB, l.PRICE, l["PACKAGE SIZE"]]
            .map(csvField).join(",")
        )
        .join("\r\n");
      return new Response(`${header}\r\n${body}\r\n`, {
        headers: { ...commonHeaders, "Content-Type": "text/csv; charset=utf-8" },
      });
    } catch (e) {
      return json(500, { error: "feed_failed", details: (e as Error).message });
    }
  },
));
