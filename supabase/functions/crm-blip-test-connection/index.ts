// crm-blip-test-connection
// Testa chave de bot Blip tentando múltiplos formatos (raw vs identifier+key em base64)
// e ambientes (prod vs hmg) até encontrar combinação que autentica.
// Comando: get /ping (read-only, sem efeito no bot).
// Body: { botId?: uuid, key?: string, identificador_externo?: string }
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z
  .object({
    botId: z.string().uuid().optional(),
    key: z.string().min(4).max(800).optional(),
    identificador_externo: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine((b) => !!b.botId || !!b.key, { message: "botId ou key obrigatório" });

const ENDPOINTS = {
  prod: "https://http.msging.net/commands",
  hmg: "https://hmg.http.msging.net/commands",
} as const;

type Env = keyof typeof ENDPOINTS;
type AuthFormat = "raw" | "identifier_pair";

type Attempt = {
  environment: Env;
  auth_format: AuthFormat;
  status: number;
  ok: boolean;
};

function toBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function buildAuthValue(format: AuthFormat, key: string, identifier: string | null): string | null {
  if (format === "raw") return key;
  if (!identifier) return null;
  // alguns paineis exibem identifier já como UUID; sempre montamos identifier:key
  return toBase64(`${identifier}:${key}`);
}

async function tryAuth(
  endpoint: string,
  authValue: string,
): Promise<{ status: number; body: unknown; identity: string | null }> {
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${authValue}`,
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      to: "postmaster@msging.net",
      method: "get",
      uri: "/ping",
    }),
    // safety net: blip costuma responder em <2s
    signal: AbortSignal.timeout(8_000),
  });
  const text = await resp.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch { /* ignore */ }

  let identity: string | null = null;
  if (body && typeof body === "object") {
    const r = body as Record<string, unknown>;
    if (typeof r.from === "string") identity = r.from as string;
    const resource = r.resource as Record<string, unknown> | undefined;
    if (!identity && resource && typeof resource.Identity === "string") {
      identity = resource.Identity as string;
    }
  }
  return { status: resp.status, body, identity };
}

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "crm-blip-test" },
    async (req, _ctx) => {
      const cors = getCorsHeaders(req);
      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "JSON inválido" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const parsed = Body.safeParse(payload);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      let key: string | null = parsed.data.key ?? null;
      let identifier: string | null = parsed.data.identificador_externo ?? null;

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Se vier botId, buscar credenciais + identifier salvos
      if (parsed.data.botId) {
        const { data, error } = await sb.rpc("crm_bot_get_auth", {
          p_bot_id: parsed.data.botId,
        });
        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: `Falha ao ler bot: ${error.message}` }),
            { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.bot_key) {
          return new Response(
            JSON.stringify({ ok: false, error: "Chave não encontrada para esse bot" }),
            { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }
        // key colada no form tem prioridade sobre a salva (caso usuário queira retestar)
        if (!key) key = row.bot_key as string;
        if (!identifier) identifier = (row.identificador_externo as string | null) ?? null;
      }

      if (!key) {
        return new Response(JSON.stringify({ ok: false, error: "Chave ausente" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const t0 = Date.now();
      const attempts: Attempt[] = [];

      const order: Array<{ env: Env; format: AuthFormat }> = [
        { env: "prod", format: "raw" },
        { env: "prod", format: "identifier_pair" },
        { env: "hmg", format: "raw" },
        { env: "hmg", format: "identifier_pair" },
      ];

      for (const { env, format } of order) {
        const authValue = buildAuthValue(format, key, identifier);
        if (!authValue) continue; // identifier_pair sem identifier → pula
        try {
          const r = await tryAuth(ENDPOINTS[env], authValue);
          attempts.push({
            environment: env,
            auth_format: format,
            status: r.status,
            ok: r.status >= 200 && r.status < 300,
          });
          if (r.status >= 200 && r.status < 300) {
            // Sucesso. Persistir formato/ambiente se temos botId.
            if (parsed.data.botId) {
              await sb.rpc("crm_bot_record_test_result", {
                p_bot_id: parsed.data.botId,
                p_ok: true,
                p_format: format,
                p_env: env,
                p_identity: r.identity,
              });
            }
            return new Response(
              JSON.stringify({
                ok: true,
                matched_format: format,
                environment: env,
                bot_identity: r.identity,
                elapsed_ms: Date.now() - t0,
                attempts,
              }),
              { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
            );
          }
          // 401/403 → tenta próximo. Outros status (5xx, 429) também caem pra próximo,
          // mas mantemos no array de attempts para diagnóstico.
        } catch (e) {
          attempts.push({
            environment: env,
            auth_format: format,
            status: 0,
            ok: false,
          });
          // network/timeout → próxima tentativa
          void e;
        }
      }

      // Falhou em todas
      if (parsed.data.botId) {
        await sb.rpc("crm_bot_record_test_result", {
          p_bot_id: parsed.data.botId,
          p_ok: false,
          p_format: null,
          p_env: null,
          p_identity: null,
        });
      }

      const tried = attempts.map((a) => `${a.environment}/${a.auth_format}=${a.status}`).join(", ");
      const has401 = attempts.some((a) => a.status === 401 || a.status === 403);
      const userMsg = has401
        ? "Credenciais rejeitadas pela Blip em todos os formatos e ambientes testados. Confirme se a chave foi copiada do painel Blip em Configurações do bot → Conexão → 'Copiar chave de autorização' e se o Identificador externo bate com o bot dessa chave."
        : "Não foi possível alcançar a Blip. Verifique a chave e tente novamente em instantes.";

      return new Response(
        JSON.stringify({
          ok: false,
          error: userMsg,
          attempts,
          tried,
          elapsed_ms: Date.now() - t0,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    },
  ),
);
