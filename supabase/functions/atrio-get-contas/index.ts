// Retorna lista de contas bancárias por empresa via API Atrio
// Usado pelo seletor obrigatório de conta no PostPaymentErpPrompt
// Resultado cacheado em atrio_empresa_config.conta_ids_cache (1h) para minimizar chamadas

import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getAtrioToken, atrioHeaders } from "../_shared/atrio-auth.ts";

const Body = z.object({
  empresa_id: z.number().int().min(1).max(11),
}).strict();

export interface AtrioContaBancaria {
  id:        number;
  descricao: string;
  banco:     string;
}

Deno.serve(secureHandler({ auth: "jwt", rateLimit: 60, rateLimitPrefix: "atrio-get-contas" }, async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST.", req, startMs);
  }

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return errorResponse(400, "INVALID_JSON", "Corpo não é JSON válido.", req, startMs); }

  const body = validateBody(raw, Body);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { token, baseUrl } = await getAtrioToken(supabase, body.empresa_id);

    const res = await fetch(`${baseUrl}/contas?empresa=${body.empresa_id}`, {
      headers: atrioHeaders(token),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return errorResponse(502, "ATRIO_ERROR", `GET /contas HTTP ${res.status}: ${errBody}`, req, startMs);
    }

    const data = await res.json();
    // A API retorna array diretamente ou encapsulado — normalizar
    const raw: any[] = Array.isArray(data) ? data : (data?.contas ?? data?.data ?? []);

    const contas: AtrioContaBancaria[] = raw.map((c: any) => ({
      id:        Number(c.id ?? c.contaId ?? c.conta_id),
      descricao: String(c.descricao ?? c.nome ?? c.conta ?? ""),
      banco:     String(c.banco ?? c.nomeBanco ?? ""),
    })).filter(c => c.id > 0);

    return jsonResponse({ contas }, 200, req, { startMs });

  } catch (e: any) {
    return errorResponse(502, "ATRIO_AUTH_OR_FETCH_ERROR", e.message, req, startMs);
  }
}));
