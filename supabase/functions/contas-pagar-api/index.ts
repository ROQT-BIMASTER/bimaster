// contas-pagar-api/index.ts — Thin router with rate limiting (Profissionalizado)
// Dispatches to handler modules in _shared/contas-pagar/
import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getKeyPreview, logApiAccess } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { withIdempotency } from "../_shared/idempotency.ts";
import type { HandlerContext } from "../_shared/contas-pagar/types.ts";
import { logRequest, logError, apiResponse, jsonRes } from "../_shared/contas-pagar/utils.ts";
// PR-5: ETag/304 em /status, /consultar, /query (GET).
// PR-6: RateLimit-{Limit,Remaining,Reset} em todas respostas.
// PR-7 (v4.0.0): paths legados removidos — applyDeprecationByPath fica como no-op defensivo.
import { applyDeprecationByPath, applyETagByPath, applyRateLimitHeaders } from "../_shared/response.ts";

// Handler imports
import { handleBulkSync, handleSyncIncremental, handleSyncChunk, handleSyncComplete, handleChunksProgress, handleSync } from "../_shared/contas-pagar/sync-handlers.ts";
import { handleConsultar, handleQuery, handleGetRoot, handleUpdate, handleCancelar, handleIncluir, handleExcluir, handleUpsert, handleUpsertLote } from "../_shared/contas-pagar/crud-handlers.ts";
import { handleLancarPagamento, handleEstornar, handleGetPagamentos } from "../_shared/contas-pagar/payment-handlers.ts";
import { handleGetParcelas, handleSyncParcelas } from "../_shared/contas-pagar/parcela-handlers.ts";
import { handlePostAnexos, handleGetAnexos } from "../_shared/contas-pagar/anexo-handlers.ts";
import { handleStatus, handleStats, handleLastSync, handleTriggerN8n, handleDebugPayload } from "../_shared/contas-pagar/infra-handlers.ts";

// PR-2: Routes que recebem idempotência server-side (escrita financeira para integradores).
// PR-7 (v4.0.0): registrar-pagamento e cancelar-pagamento removidos — substitutos: lancar-pagamento, estornar.
const CP_IDEMPOTENT_ROUTES = new Set<string>([
  "incluir:POST",
  "lancar-pagamento:POST",
  "cancelar:POST",
  "cancelar-lote:POST", // PR-18: alias batch-explícito (mesmo handler de /cancelar)
  "estornar:POST",
]);

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  // Pipeline: roteador → ETag (pode virar 304) → Deprecation (headers) → RateLimit (headers).
  let response = await runRouter(req);
  response = await applyETagByPath(req, response);
  response = applyDeprecationByPath(req, response);
  return applyRateLimitHeaders(req, response);
});

async function runRouter(req: Request): Promise<Response> {

  const corsHeaders = getCorsHeaders(req);
  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;

  logRequest(req.method, path);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ---- Auth helpers (closure over req, supabase) ----
    const getAuditMeta = () => {
      const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || undefined;
      return { endpoint: path, method: req.method, ipAddress, userAgent };
    };

    let authSource: 'api_key' | 'jwt' | null = null;
    let authUserId: string | undefined;

    const validateApiKeyFn = async (): Promise<boolean> => {
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) return false;

      const auditMeta = getAuditMeta();
      const keyPreview = getKeyPreview(apiKey);

      const expectedKey = Deno.env.get('N8N_API_KEY');
      if (apiKey && expectedKey && timingSafeEqual(apiKey, expectedKey)) {
        logApiAccess({ ...auditMeta, apiKeyUsed: true, success: true, keyPreview });
        authSource = 'api_key';
        return true;
      }

      const { data: configRow } = await supabase.from("erp_config").select("empresa_id").eq("config_key", "api_key").eq("config_value", apiKey).maybeSingle();
      if (configRow?.empresa_id) {
        logApiAccess({ ...auditMeta, apiKeyUsed: true, success: true, keyPreview });
        authSource = 'api_key';
        return true;
      }

      const { validateErpApiKey } = await import("../_shared/erp-key-validator.ts");
      const empresa = await validateErpApiKey(apiKey);
      if (empresa) {
        logApiAccess({ ...auditMeta, apiKeyUsed: true, success: true, keyPreview });
        authSource = 'api_key';
        return true;
      }

      logApiAccess({ ...auditMeta, apiKeyUsed: true, success: false, keyPreview, errorMessage: "Chave API inválida" });
      return false;
    };

    const validateAuthFn = async (): Promise<boolean> => {
      if (await validateApiKeyFn()) return true;

      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          const auditMeta = getAuditMeta();
          logApiAccess({ ...auditMeta, apiKeyUsed: false, success: true, userId: user.id });
          authSource = 'jwt';
          authUserId = user.id;
          return true;
        }
      }

      const auditMeta = getAuditMeta();
      logApiAccess({ ...auditMeta, apiKeyUsed: false, success: false, errorMessage: "Nenhuma autenticação válida" });
      return false;
    };

    // ---- Build context ----
    const ctx: HandlerContext = {
      supabase, req, url, startTime, corsHeaders,
      validateAuth: validateAuthFn,
      validateApiKey: validateApiKeyFn,
    };

    // ---- Route extraction ----
    const segment = path.split('/').pop() || '';
    const method = req.method;

    // Status endpoint — no auth, no rate limit
    if (segment === 'status' && method === 'GET') return handleStatus(ctx);

    // ---- Global Rate Limiting (Fase 2A) ----
    // Determine rate limit based on auth type (applied after route match for perf)
    const isApiKeyRequest = !!req.headers.get('x-api-key');
    const rateLimitAmount = isApiKeyRequest ? 120 : 60;
    try {
      await checkRateLimit({
        prefix: 'contas-pagar-api',
        limit: rateLimitAmount,
        req,
        userId: authUserId,
      });
    } catch (e) {
      if (e instanceof RateLimitError) {
        return apiResponse({ error: e.message }, 429, corsHeaders, startTime);
      }
    }

    // Special: /parcelas/sync (nested path)
    if (path.includes('/parcelas/sync') && method === 'POST') return handleSyncParcelas(ctx);

    // Route map: "segment:METHOD" -> handler
    type RouteHandler = (ctx: HandlerContext) => Promise<Response>;
    const routes: Record<string, RouteHandler> = {
      // Infra
      'debug-payload:POST': handleDebugPayload,
      'stats:GET': handleStats,
      'last-sync:GET': handleLastSync,
      'trigger-n8n:POST': handleTriggerN8n,

      // Sync
      'bulk-sync:POST': handleBulkSync,
      'sync-incremental:POST': handleSyncIncremental,
      'sync-chunk:POST': handleSyncChunk,
      'sync-complete:POST': handleSyncComplete,
      'chunks-progress:GET': handleChunksProgress,
      'sync:POST': handleSync,

      // CRUD (v4.0.0: /alterar e /listar removidos — use /upsert e /query)
      'consultar:GET': handleConsultar,
      'query:GET': handleQuery,
      'incluir:POST': handleIncluir,
      'excluir:DELETE': handleExcluir,
      'upsert:POST': handleUpsert,
      'upsert-lote:POST': handleUpsertLote,
      'update:PUT': handleUpdate,
      'cancelar:POST': handleCancelar,
      'cancelar-lote:POST': handleCancelar, // PR-18: alias para SDK v3.2.x — handleCancelar já é batch-aware

      // Payments (v4.0.0: /registrar-pagamento e /cancelar-pagamento removidos — use /lancar-pagamento e /estornar)
      'lancar-pagamento:POST': handleLancarPagamento,
      'estornar:POST': handleEstornar,
      'pagamentos:GET': handleGetPagamentos,

      // Parcelas
      'parcelas:GET': handleGetParcelas,

      // Anexos
      'anexos:POST': handlePostAnexos,
      'anexos:GET': handleGetAnexos,
    };

    const routeKey = `${segment}:${method}`;
    const handler = routes[routeKey];

    if (handler) {
      // PR-2: Aplica idempotência apenas para escrita financeira de integrador.
      if (CP_IDEMPOTENT_ROUTES.has(routeKey)) {
        return await withIdempotency(req, `/contas-pagar-api/${segment}`, async (cached) => {
          if (cached) return cached;
          return await handler(ctx);
        });
      }
      return handler(ctx);
    }
    // Root GET = list
    if (path.endsWith('/contas-pagar-api') && method === 'GET') return handleGetRoot(ctx);

    return apiResponse({ error: 'Not found' }, 404, corsHeaders, startTime);

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('global-handler', error, { path, duration_ms: duration });

    const pgCode = (error as any)?.code;
    const pgMsg = (error as any)?.message;
    const pgDetails = (error as any)?.details;
    if (pgCode === '22P02') return apiResponse({ error: `Formato inválido: ${pgMsg || 'verifique que campos numéricos são números, não strings.'}`, codigo_status: '1', descricao_status: pgMsg }, 400, corsHeaders, startTime);
    if (pgCode === '23503') return apiResponse({ error: `Referência inválida: ${pgDetails || pgMsg || 'verifique codigo_cliente_fornecedor, codigo_categoria e id_conta_corrente.'}`, codigo_status: '1', descricao_status: pgDetails || pgMsg }, 400, corsHeaders, startTime);
    if (pgCode === '23505') return apiResponse({ error: `Registro duplicado: ${pgMsg || 'já existe um lançamento com este código de integração.'}`, codigo_status: '2', descricao_status: pgMsg }, 409, corsHeaders, startTime);
    if (pgCode === '23502') return apiResponse({ error: `Campo obrigatório ausente: ${pgMsg || 'verifique os campos required na documentação.'}`, codigo_status: '1', descricao_status: pgMsg }, 400, corsHeaders, startTime);
    // PR-12 — PostgREST schema/cache errors (PGRST*) devem expor mensagem real, não cair em 500 genérico.
    if (typeof pgCode === 'string' && pgCode.startsWith('PGRST')) {
      return apiResponse({ error: `Erro de schema (${pgCode}): ${pgMsg}`, codigo_status: '1', descricao_status: `Erro PostgREST ${pgCode}: ${pgMsg}` }, 400, corsHeaders, startTime);
    }

    const errorMsg = error instanceof Error ? error.message : (typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : JSON.stringify(error));
    return apiResponse({
      error: errorMsg || 'Erro interno desconhecido', error_detail: errorMsg,
      codigo_status: '1', descricao_status: `Erro interno: ${errorMsg || 'erro desconhecido'}`,
    }, 500, corsHeaders, startTime);
  }
}
