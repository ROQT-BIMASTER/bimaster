// Feed de produtos para o iPaper (Enrichment Automation / Auto Update).
// Substitui a planilha manual "ESTOQUE CATALOGOS IPAPER PADRÃO.xlsx":
// junta ipaper_produtos (de-para ID iPaper <-> CODHB + preço/embalagem)
// com o estoque vivo de fornecedor_estoque_futura (sincronizado a cada 15min).
// Auth: token compartilhado (?token= ou Bearer) — o iPaper busca a URL sem JWT.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

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

async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const provided = url.searchParams.get("token") ??
      (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
    if (!provided || !constantTimeEquals(provided, expected)) {
      return json(401, { error: "unauthorized" });
    }

    const format = url.searchParams.get("format") ?? "csv";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
      const [produtos, estoque] = await Promise.all([
        fetchAll<{ ipaper_id: number; nome: string; codhb: string | null; preco: number | null; package_size: number | null }>(
          (from, to) => supabase
            .from("ipaper_produtos")
            .select("ipaper_id, nome, codhb, preco, package_size")
            .eq("ativo", true)
            .order("ipaper_id")
            .range(from, to),
        ),
        fetchAll<{ codigo_produto: string; estoque_caixas: number | null }>(
          (from, to) => supabase
            .from("fornecedor_estoque_futura")
            .select("codigo_produto, estoque_caixas")
            .order("erp_id")
            .range(from, to),
        ),
      ]);

      // Soma o saldo por código (o conector traz uma linha por empresa da Futura)
      const saldoPorCodigo = new Map<string, number>();
      for (const e of estoque) {
        const cod = (e.codigo_produto ?? "").trim().toUpperCase();
        if (!cod) continue;
        saldoPorCodigo.set(cod, (saldoPorCodigo.get(cod) ?? 0) + (e.estoque_caixas ?? 0));
      }

      const linhas = produtos.map((p) => {
        const cod = (p.codhb ?? "").trim().toUpperCase();
        const saldo = cod ? saldoPorCodigo.get(cod) : undefined;
        return {
          ID: p.ipaper_id,
          NAME: p.nome,
          STOCK: saldo === undefined ? 0 : Math.max(0, Math.floor(saldo)),
          DESCRIPTION: "",
          CODHB: p.codhb ?? "",
          PRICE: p.preco,
          "PACKAGE SIZE": p.package_size,
        };
      });

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
