// dre-cadastro-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function calcNivel(code: string): number {
  if (!code) return 1;
  return code.split(".").length;
}

function calcSinal(categoriaDre: string | null): string {
  if (!categoriaDre) return "-";
  const lower = categoriaDre.toLowerCase();
  if (lower.includes("receita") || lower === "r") return "+";
  return "-";
}

function mapDreLista(row: Record<string, unknown>): Record<string, unknown> {
  const code = (row.codigo_dre_gerencial as string) || (row.code as string) || "";
  return {
    codigoDRE: code,
    descricaoDRE: (row.name as string) || "",
    naoExibirDRE: row.is_active === false ? "S" : "N",
    nivelDRE: calcNivel(code),
    sinalDRE: calcSinal(row.categoria_dre as string | null),
    totalizaDRE: "N",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/dre-cadastro-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse({ status: "ok", function: "dre-cadastro-api", routes: ["/listar", "/status"] }, 200, req, { startMs });
    }

    // Auth
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "dre-cadastro", limit: 60, req, userId: auth.userId });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // POST /listar — ListarCadastroDRE
    if (req.method === "POST" && path === "/listar") {
      const body = await req.json().catch(() => ({}));
      const apenasAtivas = (body.apenasContasAtivas || "N").toUpperCase() === "S";

      let query = supabase
        .from("trade_chart_of_accounts")
        .select("code, name, is_active, categoria_dre, codigo_dre_gerencial")
        .not("categoria_dre", "is", null)
        .order("code", { ascending: true });

      if (apenasAtivas) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      const dreLista = (data || []).map(mapDreLista);

      return jsonResponse({
        totalRegistros: dreLista.length,
        dreLista,
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; name?: string };
    if (e.name === "RateLimitError" || (e as any) instanceof RateLimitError) {
      return errorResponse(429, "RATE_LIMIT", e.message || "Rate limit excedido", req, startMs);
    }
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ dre-cadastro-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
