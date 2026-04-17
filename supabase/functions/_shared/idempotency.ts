// _shared/idempotency.ts — Server-side request deduplication (PR-2 / P2)
//
// Auto-contido. NÃO importa _shared/response.ts — o helper escolhe como formatar a resposta.
// Cobre os 9 endpoints POST de escrita financeira da matriz (CR, CP, parcelas, erp-export).
//
// Contrato (RFC draft-ietf-httpapi-idempotency-key-header):
//   - Header `Idempotency-Key`: string 16-128 chars, [a-zA-Z0-9-].
//   - Mesma key + mesmo body → resposta cacheada (200 + header `Idempotent-Replay: true`).
//   - Mesma key + body diferente → 409 IDEMPOTENCY_KEY_CONFLICT.
//   - Sem key → passa direto (sem cache). Idempotência é opt-in pelo cliente.
//   - Apenas respostas 2xx são cacheadas (erros podem ser transitórios).
//   - TTL: 24h.

import { createClient } from "npm:@supabase/supabase-js@2";

const TTL_HOURS = 24;
const KEY_PATTERN = /^[a-zA-Z0-9-]{16,128}$/;

export interface IdempotencyHit {
  cached: true;
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface IdempotencyMiss {
  cached: false;
}

export type IdempotencyResult = IdempotencyHit | IdempotencyMiss;

export class IdempotencyConflictError extends Error {
  constructor(message = "IDEMPOTENCY_KEY_CONFLICT: same key, different body") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class InvalidIdempotencyKeyError extends Error {
  constructor(message = "INVALID_IDEMPOTENCY_KEY: must be 16-128 alphanumeric chars (a-zA-Z0-9-)") {
    super(message);
    this.name = "InvalidIdempotencyKeyError";
  }
}

function getKey(req: Request): string | null {
  return req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("idempotency: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
  }
  return createClient(url, key);
}

/**
 * Verifica se há resposta cacheada para esta (key, endpoint).
 * Retorna {cached:true,...} para hit (handler deve devolver direto) ou {cached:false} para miss.
 *
 * Lança:
 *   - InvalidIdempotencyKeyError: key fora do padrão.
 *   - IdempotencyConflictError: mesma key, body diferente.
 */
export async function checkIdempotency(
  req: Request,
  endpointPath: string,
  bodyText?: string,
): Promise<IdempotencyResult> {
  const key = getKey(req);
  if (!key) return { cached: false };

  if (!KEY_PATTERN.test(key)) {
    throw new InvalidIdempotencyKeyError();
  }

  const text = bodyText ?? (await req.clone().text());
  const bodyHash = await sha256(text);

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("api_idempotency_cache")
    .select("body_hash, response_status, response_body, response_headers")
    .eq("idempotency_key", key)
    .eq("endpoint_path", endpointPath)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return { cached: false };

  if (data.body_hash !== bodyHash) {
    throw new IdempotencyConflictError();
  }

  return {
    cached: true,
    status: data.response_status as number,
    body: data.response_body,
    headers: (data.response_headers ?? undefined) as Record<string, string> | undefined,
  };
}

/**
 * Persiste resposta no cache. Apenas 2xx são gravadas.
 */
export async function storeIdempotency(
  req: Request,
  endpointPath: string,
  status: number,
  body: unknown,
  options?: { headers?: Record<string, string>; bodyText?: string },
): Promise<void> {
  const key = getKey(req);
  if (!key) return;
  if (status < 200 || status >= 300) return;

  const text = options?.bodyText ?? (await req.clone().text());
  const bodyHash = await sha256(text);

  const supabase = getServiceClient();
  await supabase.from("api_idempotency_cache").upsert(
    {
      idempotency_key: key,
      endpoint_path: endpointPath,
      body_hash: bodyHash,
      response_status: status,
      response_body: body,
      response_headers: options?.headers ?? null,
      expires_at: new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString(),
    },
    { onConflict: "idempotency_key,endpoint_path" },
  );
}

/**
 * Wrap pattern: executa handler, persiste 2xx no cache se houver Idempotency-Key.
 * Retorna a Response do handler (com header Idempotent-Replay quando hit).
 *
 * Uso típico no router:
 *   return await withIdempotency(req, "/contas-receber-api/incluir", async (cached) => {
 *     if (cached) return cached;       // hit, devolve direto
 *     const resp = await handlerLogic();
 *     return resp;                      // miss, será persistido após retorno
 *   });
 */
export async function withIdempotency(
  req: Request,
  endpointPath: string,
  handler: (cachedResponse: Response | null) => Promise<Response>,
): Promise<Response> {
  // Pre-lê body uma vez (handler vai re-ler via req.clone() — isso é ok porque clone preserva)
  let bodyText = "";
  try {
    bodyText = await req.clone().text();
  } catch {
    bodyText = "";
  }

  let lookup: IdempotencyResult;
  try {
    lookup = await checkIdempotency(req, endpointPath, bodyText);
  } catch (err) {
    if (err instanceof InvalidIdempotencyKeyError) {
      return new Response(
        JSON.stringify({
          error: "INVALID_IDEMPOTENCY_KEY",
          message: err.message,
          codigo_status: "1",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (err instanceof IdempotencyConflictError) {
      return new Response(
        JSON.stringify({
          error: "IDEMPOTENCY_KEY_CONFLICT",
          message: err.message,
          codigo_status: "1",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }
    // Falha na infra de idempotência NÃO bloqueia: loga e segue sem cache.
    console.error("[idempotency] lookup failed, proceeding without cache:", err);
    lookup = { cached: false };
  }

  if (lookup.cached) {
    const cachedHeaders = new Headers(lookup.headers ?? {});
    cachedHeaders.set("Content-Type", "application/json");
    cachedHeaders.set("Idempotent-Replay", "true");
    const cachedResp = new Response(JSON.stringify(lookup.body), {
      status: lookup.status,
      headers: cachedHeaders,
    });
    return await handler(cachedResp);
  }

  const resp = await handler(null);

  // Persistir após handler completar (2xx apenas)
  if (resp.status >= 200 && resp.status < 300 && getKey(req)) {
    try {
      const respBodyText = await resp.clone().text();
      let respBody: unknown = respBodyText;
      try {
        respBody = JSON.parse(respBodyText);
      } catch {
        // body não-JSON: armazena como string
      }
      // Captura headers relevantes (sem CORS dinâmicos)
      const headersToStore: Record<string, string> = {};
      const xrid = resp.headers.get("X-Request-ID");
      if (xrid) headersToStore["X-Request-ID"] = xrid;

      await storeIdempotency(req, endpointPath, resp.status, respBody, {
        headers: Object.keys(headersToStore).length ? headersToStore : undefined,
        bodyText,
      });
    } catch (err) {
      console.error("[idempotency] store failed (non-blocking):", err);
    }
  }

  return resp;
}
