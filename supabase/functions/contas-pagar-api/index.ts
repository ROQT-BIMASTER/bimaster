// contas-pagar-api/index.ts — Thin router with rate limiting (Profissionalizado)
// Dispatches to handler modules in _shared/contas-pagar/
import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getKeyPreview, logApiAccess } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import type { HandlerContext } from "../_shared/contas-pagar/types.ts";
import { logRequest, logError, apiResponse, jsonRes } from "../_shared/contas-pagar/utils.ts";

// Handler imports
import { handleBulkSync, handleSyncIncremental, handleSyncChunk, handleSyncComplete, handleChunksProgress, handleSync } from "../_shared/contas-pagar/sync-handlers.ts";
import { handleConsultar, handleListar, handleQuery, handleGetRoot, handleUpdate, handleCancelar, handleIncluir, handleAlterar, handleExcluir, handleUpsert, handleUpsertLote } from "../_shared/contas-pagar/crud-handlers.ts";
import { handleRegistrarPagamento, handleLancarPagamento, handleCancelarPagamento, handleEstornar, handleGetPagamentos } from "../_shared/contas-pagar/payment-handlers.ts";
import { handleGetParcelas, handleSyncParcelas } from "../_shared/contas-pagar/parcela-handlers.ts";
import { handlePostAnexos, handleGetAnexos } from "../_shared/contas-pagar/anexo-handlers.ts";
import { handleStatus, handleStats, handleLastSync, handleTriggerN8n, handleDebugPayload } from "../_shared/contas-pagar/infra-handlers.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

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

      // CRUD
      'consultar:GET': handleConsultar,
      'listar:GET': handleListar,
      'query:GET': handleQuery,
      'incluir:POST': handleIncluir,
      'alterar:PUT': handleAlterar,
      'excluir:DELETE': handleExcluir,
      'upsert:POST': handleUpsert,
      'upsert-lote:POST': handleUpsertLote,
      'update:PUT': handleUpdate,
      'cancelar:POST': handleCancelar,

      // Payments
      'registrar-pagamento:POST': handleRegistrarPagamento,
      'lancar-pagamento:POST': handleLancarPagamento,
      'cancelar-pagamento:POST': handleCancelarPagamento,
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

    if (handler) return handler(ctx);

    // Root GET = list
    if (path.endsWith('/contas-pagar-api') && method === 'GET') return handleGetRoot(ctx);

    return apiResponse({ error: 'Not found' }, 404, corsHeaders, startTime);

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('global-handler', error, { path, duration_ms: duration });

    const pgCode = (error as any)?.code;
    if (pgCode === '22P02') return apiResponse({ error: 'Formato inválido: verifique que campos numéricos são números, não strings.', codigo_status: '1' }, 400, corsHeaders, startTime);
    if (pgCode === '23503') return apiResponse({ error: 'Referência inválida: verifique codigo_cliente_fornecedor, codigo_categoria e id_conta_corrente.', codigo_status: '1' }, 400, corsHeaders, startTime);
    if (pgCode === '23505') return apiResponse({ error: 'Registro duplicado: já existe um lançamento com este código de integração.', codigo_status: '2' }, 409, corsHeaders, startTime);
    if (pgCode === '23502') return apiResponse({ error: 'Campo obrigatório ausente: verifique os campos required na documentação.', codigo_status: '1' }, 400, corsHeaders, startTime);

    const errorMsg = error instanceof Error ? error.message : (typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : JSON.stringify(error));
    return apiResponse({
      error: errorMsg || 'Erro interno desconhecido', error_detail: errorMsg,
      codigo_status: '1', descricao_status: `Erro interno: ${errorMsg || 'erro desconhecido'}`,
    }, 500, corsHeaders, startTime);
  }
});
