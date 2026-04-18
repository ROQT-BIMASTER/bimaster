// health — endpoint público de versionamento (PR-10 v3.1.2)
// Retorna versão atual da API para destravar diagnóstico de drift entre código e deploy.
// Não exige autenticação. Não loga payload. Resposta < 200 bytes.

import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

export const API_VERSION = "3.1.2";
export const BUILD_TIMESTAMP = "2026-04-18T00:00:00Z";

Deno.serve((req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const requestId = crypto.randomUUID();
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json", "X-Request-ID": requestId },
    false
  );

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed", request_id: requestId }),
      { status: 405, headers }
    );
  }

  return new Response(
    JSON.stringify({
      status: "ok",
      api_version: API_VERSION,
      build_timestamp: BUILD_TIMESTAMP,
      request_id: requestId,
    }),
    { status: 200, headers }
  );
});
