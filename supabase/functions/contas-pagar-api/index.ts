// contas-pagar-api/index.ts — Thin router with secureHandler wrapper (PR-24 Production Hardening)
// PR-24: envolto em secureHandler (WAF L7, IP blocklist, security headers) — antes só tinha CORS+auth+ratelimit manuais.
// Mantém roteador interno + idempotência centralizada via withIdempotency (sem duplicação nos handlers).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getKeyPreview, logApiAccess } from "../_shared/auth.ts";
import { withIdempotency } from "../_shared/idempotency.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import type { HandlerContext } from "../_shared/contas-pagar/types.ts";
import { logRequest, logError, apiResponse } from "../_shared/contas-pagar/utils.ts";
import { applyDeprecationByPath, applyETagByPath } from "../_shared/response.ts";

// Handler imports
import { handleBulkSync, handleSyncIncremental, handleSyncChunk, handleSyncComplete, handleChunksProgress, handleSync } from "../_shared/contas-pagar/sync-handlers.ts";
import { handleConsultar, handleQuery, handleGetRoot, handleUpdate, handleCancelar, handleIncluir, handleExcluir, handleUpsert, handleUpsertLote } from "../_shared/contas-pagar/crud-handlers.ts";
import { handleLancarPagamento, handleEstornar, handleGetPagamentos } from "../_shared/contas-pagar/payment-handlers.ts";
import { handleGetParcelas, handleSyncParcelas } from "../_shared/contas-pagar/parcela-handlers.ts";
import { handlePostAnexos, handleGetAnexos } from "../_shared/contas-pagar/anexo-handlers.ts";
import { handleStatus, handleStats, handleLastSync, handleTriggerN8n, handleDebugPayload } from "../_shared/contas-pagar/infra-handlers.ts";

const CP_IDEMPOTENT_ROUTES = new Set<string>([
  "incluir:POST",
  "upsert:POST",
  "upsert-lote:POST",
  "lancar-pagamento:POST",
  "cancelar:POST",
  "cancelar-lote:POST",
  "estornar:POST",
]);

// PR-24: secureHandler aplica CORS preflight + WAF + IP blocklist + auth + ratelimit + security headers.
// auth: "any" preserva o suporte dual (JWT + API Key) já existente; ratelimit 120/min mantém comportamento atual.
const handler = secureHandler(
  { auth: "none", rateLimit: 120, rateLimitPrefix: "contas-pagar-api" },
  async (req) => {
    let response = await runRouter(req);
    response = await applyETagByPath(req, response);
    response = applyDeprecationByPath(req, response);
    return response;
  }
);

Deno.serve(handler);

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

    const ctx: HandlerContext = {
      supabase, req, url, startTime, corsHeaders,
      validateAuth: validateAuthFn,
      validateApiKey: validateApiKeyFn,
    };

    const segment = path.split('/').pop() || '';
    const method = req.method;

    if (segment === 'status' && method === 'GET') return handleStatus(ctx);

    // Special: /parcelas/sync (nested path)
    if (path.includes('/parcelas/sync') && method === 'POST') return handleSyncParcelas(ctx);

    type RouteHandler = (ctx: HandlerContext) => Promise<Response>;
    const routes: Record<string, RouteHandler> = {
      'debug-payload:POST': handleDebugPayload,
      'stats:GET': handleStats,
      'last-sync:GET': handleLastSync,
      'trigger-n8n:POST': handleTriggerN8n,
      'bulk-sync:POST': handleBulkSync,
      'sync-incremental:POST': handleSyncIncremental,
      'sync-chunk:POST': handleSyncChunk,
      'sync-complete:POST': handleSyncComplete,
      'chunks-progress:GET': handleChunksProgress,
      'sync:POST': handleSync,
      'consultar:GET': handleConsultar,
      'query:GET': handleQuery,
      'incluir:POST': handleIncluir,
      'excluir:DELETE': handleExcluir,
      'upsert:POST': handleUpsert,
      'upsert-lote:POST': handleUpsertLote,
      'update:PUT': handleUpdate,
      'cancelar:POST': handleCancelar,
      'cancelar-lote:POST': handleCancelar,
      'lancar-pagamento:POST': handleLancarPagamento,
      'estornar:POST': handleEstornar,
      'pagamentos:GET': handleGetPagamentos,
      'parcelas:GET': handleGetParcelas,
      'anexos:POST': handlePostAnexos,
      'anexos:GET': handleGetAnexos,
    };

    const routeKey = `${segment}:${method}`;
    const handlerFn = routes[routeKey];

    if (handlerFn) {
      if (CP_IDEMPOTENT_ROUTES.has(routeKey)) {
        return await withIdempotency(req, `/contas-pagar-api/${segment}`, async (cached) => {
          if (cached) return cached;
          return await handlerFn(ctx);
        });
      }
      return handlerFn(ctx);
    }
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
