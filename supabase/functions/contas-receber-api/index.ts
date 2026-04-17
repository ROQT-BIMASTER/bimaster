import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from "https://esm.sh/zod@3.22.4";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { enqueueWebhookEvent } from "../_shared/webhook-enqueue.ts";
import { wafCheck, wafBlockResponse } from "../_shared/waf.ts";
import { sanitizeString } from "../_shared/validate.ts";
import { withIdempotency } from "../_shared/idempotency.ts";
// PR-1B: helpers compartilhados — injetam X-Request-ID (header) + meta.request_id (body).
import { jsonResponse as sharedJsonResponse } from "../_shared/response.ts";

const API_VERSION = '1.2.0';

// Status imutáveis — títulos nestes estados não podem ser alterados/excluídos/cancelados
const IMMUTABLE_STATUSES = ['Liquidado', 'Cancelado'];

// ── Zod Schemas ──

const strOrNum = z.union([z.string(), z.number()]).transform(String);
const strOrNumOpt = z.union([z.string(), z.number()]).transform(String).optional();

const IncluirSchema = z.object({
  codigo_lancamento_integracao: strOrNum,
  codigo_cliente_fornecedor: strOrNumOpt,
  data_vencimento: z.string().max(20).optional(),
  valor_documento: z.number().optional(),
  valor_original: z.number().optional(),
  codigo_categoria: strOrNumOpt,
  data_previsao: z.string().max(20).optional(),
  empresa_id: z.preprocess((v) => v != null ? Number(v) : undefined, z.number().int().optional()),
  observacao: z.string().max(2000).optional(),
  descricao: z.string().max(2000).optional(),
}).strict();

const AlterarSchema = z.object({
  id: z.string().uuid().optional(),
  codigo_lancamento_integracao: strOrNumOpt,
  valor_documento: z.number().optional(),
  data_vencimento: z.string().max(20).optional(),
  data_previsao: z.string().max(20).optional(),
  codigo_categoria: strOrNumOpt,
  observacao: z.string().max(2000).optional(),
  codigo_cliente_fornecedor: strOrNumOpt,
}).refine(d => d.id || d.codigo_lancamento_integracao, { message: 'id ou codigo_lancamento_integracao obrigatório' });

const UpsertSchema = IncluirSchema; // inherits .strict()

const RecebimentoSchema = z.object({
  codigo_lancamento_integracao: strOrNum,
  valor: z.number().positive(),
  data: z.string().max(20).optional(),
  desconto: z.number().min(0).optional(),
  juros: z.number().min(0).optional(),
  multa: z.number().min(0).optional(),
  observacao: z.string().max(2000).optional(),
});

const CancelarSchema = z.object({
  chave_lancamento: strOrNumOpt,
  codigo_lancamento_integracao: strOrNumOpt,
}).refine(d => d.chave_lancamento || d.codigo_lancamento_integracao, { message: 'chave_lancamento ou codigo_lancamento_integracao obrigatório' });

// PR-3 (P3) — Estorno de título
const EstornarSchema = z.object({
  nCodTitulo: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  codigo_lancamento_integracao: strOrNumOpt,
  cMotivo: z.string().max(500).optional(),
}).refine(d => d.nCodTitulo || d.codigo_lancamento_integracao, {
  message: 'nCodTitulo ou codigo_lancamento_integracao obrigatório',
});

const LoteItemSchema = z.object({
  codigo_lancamento_integracao: strOrNum,
  codigo_cliente_fornecedor: strOrNumOpt,
  data_vencimento: z.string().max(20).optional(),
  valor_documento: z.number().optional(),
  valor_original: z.number().optional(),
  codigo_categoria: strOrNumOpt,
  empresa_id: z.preprocess((v) => v != null ? Number(v) : undefined, z.number().int().optional()),
}).strict();

// Allowed fields for sync (whitelist to prevent mass assignment)
const SYNC_ALLOWED_FIELDS = new Set([
  'erp_id', 'empresa_id', 'empresa_nome', 'cliente_codigo', 'cliente_nome',
  'tipo_documento', 'numero_documento', 'parcela', 'data_emissao',
  'data_vencimento', 'data_recebimento', 'valor_original', 'valor_aberto',
  'valor_recebido', 'status',
]);

// ── Helpers ──

function parseDate(dateValue: unknown): string | null {
  if (!dateValue) return null;
  const s = String(dateValue);
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

/**
 * PR-1B: Factory que retorna um jsonResponse com a assinatura local legada
 * (data, status, corsHeaders), mas internamente delega ao shared para injetar
 * X-Request-ID (header) + meta.request_id (body) automaticamente.
 *
 * Mantém compatibilidade com 80+ chamadas existentes sem refactor mecânico.
 */
function makeJsonResponse(req: Request) {
  return function jsonResponse(
    data: unknown,
    status: number,
    _corsHeaders: Record<string, string>,
  ): Response {
    // shared injeta CORS via getCorsHeaders(req) + security headers + request_id
    return sharedJsonResponse(data, status, req);
  };
}

async function auditLog(supabase: any, action: string, userId: string | undefined, meta: Record<string, unknown>) {
  await supabase.from('security_audit_log').insert({
    action,
    severity: 'medium',
    metadata: { ...meta, user_id: userId, timestamp: new Date().toISOString() },
  }).catch(() => {});
}

function makeZodError(jsonResponse: ReturnType<typeof makeJsonResponse>) {
  return function zodError(err: z.ZodError, corsHeaders: Record<string, string>) {
    return jsonResponse({ error: 'Payload inválido', details: err.flatten().fieldErrors }, 400, corsHeaders);
  };
}

// ── Main Handler ──

// PR-2: Paths POST cobertos por idempotência server-side (TTL 24h via api_idempotency_cache).
const CR_IDEMPOTENT_WRITE_PATHS = new Set([
  "/incluir",
  "/lancar-recebimento",
  "/cancelar",
  "/estornar",
]);

function isCrWritePath(req: Request): { yes: boolean; path: string } {
  if (req.method !== "POST") return { yes: false, path: "" };
  const url = new URL(req.url);
  for (const p of CR_IDEMPOTENT_WRITE_PATHS) {
    if (url.pathname.endsWith(p)) {
      return { yes: true, path: `/contas-receber-api${p}` };
    }
  }
  return { yes: false, path: "" };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;
  const corsHeaders = getCorsHeaders(req);

  const writeCheck = isCrWritePath(req);
  if (writeCheck.yes) {
    return await withIdempotency(req, writeCheck.path, async (cached) => {
      if (cached) return cached;
      return await runHandler(req, corsHeaders);
    });
  }

  return await runHandler(req, corsHeaders);
});

async function runHandler(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
  // PR-1B: factories locais — todas as 80+ chamadas a jsonResponse(...) e zodError(...)
  // continuam funcionando, mas agora cascateiam X-Request-ID + meta.request_id via shared.
  const jsonResponse = makeJsonResponse(req);
  const zodError = makeZodError(jsonResponse);

  try {
    // WAF L7 check
    const wafResult = await wafCheck(req);
    if (!wafResult.allowed) return wafBlockResponse(wafResult, corsHeaders);

    const url = new URL(req.url);
    const path = url.pathname;

    // ========== GET /status — Health check (NO AUTH REQUIRED) ==========
    if (path.endsWith('/status') && req.method === 'GET') {
      return jsonResponse({
        status: 'online', version: API_VERSION,
        timestamp: new Date().toISOString(), service: 'contas-receber-api',
      }, 200, corsHeaders);
    }

    // Auth for all other routes
    const auth = await validateAnyAuth(req);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate limit with correct signature
    await checkRateLimit({ prefix: 'cr-api', limit: 60, req, userId: auth.userId });

    // ========== GET /consultar ==========
    if (path.endsWith('/consultar') && req.method === 'GET') {
      const id = url.searchParams.get('id');
      const codIntegracao = url.searchParams.get('codigo_lancamento_integracao');
      const codHuggs = url.searchParams.get('codigo_lancamento_huggs');

      let query = supabase.from('contas_receber').select('*');
      if (id) query = query.eq('id', id);
      else if (codIntegracao) query = query.eq('codigo_lancamento_integracao', codIntegracao);
      else if (codHuggs) query = query.eq('codigo_lancamento_huggs', Number(codHuggs));
      else return jsonResponse({ error: 'Informe id, codigo_lancamento_integracao ou codigo_lancamento_huggs' }, 400, corsHeaders);

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: 'Registro não encontrado' }, 404, corsHeaders);
      return jsonResponse(data, 200, corsHeaders);
    }

    // ========== POST /incluir ==========
    if (path.endsWith('/incluir') && req.method === 'POST') {
      const raw = await req.json();
      const parsed = IncluirSchema.safeParse(raw);
      if (!parsed.success) return zodError(parsed.error, corsHeaders);
      const body = parsed.data;

      // Validar referências antes da escrita
      if (body.empresa_id) {
        const { data: emp } = await supabase.from('empresas').select('id').eq('id', body.empresa_id).maybeSingle();
        if (!emp) {
          return jsonResponse({
            codigo_lancamento_integracao: body.codigo_lancamento_integracao,
            codigo_status: '1',
            descricao_status: `Empresa não encontrada: empresa_id '${body.empresa_id}' não existe no cadastro`
          }, 400, corsHeaders);
        }
      }

      const { data: existing } = await supabase
        .from('contas_receber').select('id')
        .eq('codigo_lancamento_integracao', body.codigo_lancamento_integracao)
        .maybeSingle();

      if (existing) {
        return jsonResponse({
          codigo_lancamento_integracao: body.codigo_lancamento_integracao,
          codigo_status: '3', descricao_status: 'Registro já existe. Use /upsert ou /alterar.',
        }, 409, corsHeaders);
      }

      const insertData: Record<string, unknown> = {
        codigo_lancamento_integracao: body.codigo_lancamento_integracao,
        codigo_cliente_fornecedor: body.codigo_cliente_fornecedor,
        data_vencimento: parseDate(body.data_vencimento),
        valor_original: body.valor_documento || body.valor_original,
        categoria: body.codigo_categoria,
        data_previsao: parseDate(body.data_previsao),
        empresa_id: body.empresa_id,
        descricao: sanitizeString(body.observacao || body.descricao || ''),
        enviado_erp: false,
      };

      const { data, error } = await supabase.from('contas_receber').insert(insertData).select().single();
      if (error) throw error;

      await auditLog(supabase, 'cr_api_incluir', auth.userId, { id: data.id, codigo: body.codigo_lancamento_integracao });
      enqueueWebhookEvent('conta_receber.incluida', { id: data.id, codigo_lancamento_integracao: body.codigo_lancamento_integracao }, body.empresa_id).catch(() => {});

      return jsonResponse({
        codigo_lancamento_huggs: data.codigo_lancamento_huggs,
        codigo_lancamento_integracao: body.codigo_lancamento_integracao,
        codigo_status: '0', descricao_status: 'Cadastro incluído com sucesso!',
      }, 201, corsHeaders);
    }

    // ========== PUT /alterar ==========
    if (path.endsWith('/alterar') && req.method === 'PUT') {
      const raw = await req.json();
      const parsed = AlterarSchema.safeParse(raw);
      if (!parsed.success) return zodError(parsed.error, corsHeaders);
      const body = parsed.data;

      // Governança: buscar título e verificar status
      let govQuery = supabase.from('contas_receber').select('id, status, empresa_id');
      if (body.id) govQuery = govQuery.eq('id', body.id);
      else govQuery = govQuery.eq('codigo_lancamento_integracao', body.codigo_lancamento_integracao!);
      const { data: tituloGov } = await govQuery.maybeSingle();

      if (!tituloGov) return jsonResponse({ error: 'Registro não encontrado' }, 404, corsHeaders);

      if (IMMUTABLE_STATUSES.includes(tituloGov.status)) {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: `Alteração não permitida para títulos com status "${tituloGov.status}".`,
        }, 400, corsHeaders);
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.valor_documento !== undefined) updateData.valor_original = body.valor_documento;
      if (body.data_vencimento) updateData.data_vencimento = parseDate(body.data_vencimento);
      if (body.data_previsao) updateData.data_previsao = parseDate(body.data_previsao);
      if (body.codigo_categoria) updateData.categoria = body.codigo_categoria;
      if (body.observacao !== undefined) updateData.descricao = sanitizeString(body.observacao);
      if (body.codigo_cliente_fornecedor) updateData.codigo_cliente_fornecedor = body.codigo_cliente_fornecedor;

      const { data, error } = await supabase.from('contas_receber').update(updateData).eq('id', tituloGov.id).select().maybeSingle();
      if (error) throw error;

      await auditLog(supabase, 'cr_api_alterar', auth.userId, { id: data.id, fields: Object.keys(updateData) });
      enqueueWebhookEvent('conta_receber.alterada', { id: data.id, codigo_lancamento_integracao: data.codigo_lancamento_integracao }, tituloGov.empresa_id).catch(() => {});

      return jsonResponse({
        codigo_lancamento_integracao: data.codigo_lancamento_integracao,
        codigo_status: '0', descricao_status: 'Registro alterado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== DELETE /excluir ==========
    if (path.endsWith('/excluir') && req.method === 'DELETE') {
      const codIntegracao = url.searchParams.get('codigo_lancamento_integracao');
      const id = url.searchParams.get('id');
      if (!codIntegracao && !id) {
        return jsonResponse({ error: 'codigo_lancamento_integracao ou id obrigatório' }, 400, corsHeaders);
      }

      // Governança: buscar e verificar status
      let govQuery = supabase.from('contas_receber').select('id, status, empresa_id, codigo_lancamento_integracao');
      if (id) govQuery = govQuery.eq('id', id);
      else govQuery = govQuery.eq('codigo_lancamento_integracao', codIntegracao);
      const { data: tituloGov } = await govQuery.maybeSingle();

      if (!tituloGov) return jsonResponse({ error: 'Registro não encontrado' }, 404, corsHeaders);

      if (IMMUTABLE_STATUSES.includes(tituloGov.status)) {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: `Exclusão não permitida para títulos com status "${tituloGov.status}".`,
        }, 400, corsHeaders);
      }

      const { error } = await supabase.from('contas_receber')
        .update({ inativo: true, updated_at: new Date().toISOString() })
        .eq('id', tituloGov.id);
      if (error) throw error;

      await auditLog(supabase, 'cr_api_excluir', auth.userId, { id: tituloGov.id });
      enqueueWebhookEvent('conta_receber.excluida', { id: tituloGov.id, codigo_lancamento_integracao: tituloGov.codigo_lancamento_integracao }, tituloGov.empresa_id).catch(() => {});

      return jsonResponse({
        codigo_lancamento_integracao: tituloGov.codigo_lancamento_integracao,
        codigo_status: '0', descricao_status: 'Registro excluído com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /upsert ==========
    if (path.endsWith('/upsert') && !path.includes('upsert-lote') && req.method === 'POST') {
      const raw = await req.json();
      const parsed = UpsertSchema.safeParse(raw);
      if (!parsed.success) return zodError(parsed.error, corsHeaders);
      const body = parsed.data;

      // Validar referências antes da escrita
      if (body.empresa_id) {
        const { data: emp } = await supabase.from('empresas').select('id').eq('id', body.empresa_id).maybeSingle();
        if (!emp) {
          return jsonResponse({
            codigo_lancamento_integracao: body.codigo_lancamento_integracao,
            codigo_status: '1',
            descricao_status: `Empresa não encontrada: empresa_id '${body.empresa_id}' não existe no cadastro`
          }, 400, corsHeaders);
        }
      }

      const upsertData: Record<string, unknown> = {
        codigo_lancamento_integracao: body.codigo_lancamento_integracao,
        codigo_cliente_fornecedor: body.codigo_cliente_fornecedor,
        data_vencimento: parseDate(body.data_vencimento),
        valor_original: body.valor_documento || body.valor_original,
        categoria: body.codigo_categoria,
        data_previsao: parseDate(body.data_previsao),
        empresa_id: body.empresa_id,
        descricao: sanitizeString(body.observacao || body.descricao || ''),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(upsertData, { onConflict: 'empresa_id,codigo_lancamento_integracao' })
        .select().single();
      if (error) throw error;

      await auditLog(supabase, 'cr_api_upsert', auth.userId, { id: data.id, codigo: body.codigo_lancamento_integracao });
      enqueueWebhookEvent('conta_receber.upsert', { id: data.id, codigo_lancamento_integracao: body.codigo_lancamento_integracao }, body.empresa_id).catch(() => {});

      return jsonResponse({
        codigo_lancamento_huggs: data.codigo_lancamento_huggs,
        codigo_lancamento_integracao: body.codigo_lancamento_integracao,
        codigo_status: '0', descricao_status: 'Upsert realizado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /upsert-lote ==========
    if (path.endsWith('/upsert-lote') && req.method === 'POST') {
      const raw = await req.json();
      const registros = raw.conta_receber_cadastro || raw.registros || [];
      if (!Array.isArray(registros) || registros.length === 0) {
        return jsonResponse({ error: 'Array de registros vazio' }, 400, corsHeaders);
      }
      if (registros.length > 500) {
        return jsonResponse({ error: 'Máximo 500 registros por lote' }, 400, corsHeaders);
      }

      // Validate each item with Zod + referências
      const validItems: z.infer<typeof LoteItemSchema>[] = [];
      for (let i = 0; i < registros.length; i++) {
        const p = LoteItemSchema.safeParse(registros[i]);
        if (!p.success) {
          return jsonResponse({ error: `Item ${i}: payload inválido`, details: p.error.flatten().fieldErrors }, 400, corsHeaders);
        }
        // Validar empresa_id por item
        if (p.data.empresa_id) {
          const { data: emp } = await supabase.from('empresas').select('id').eq('id', p.data.empresa_id).maybeSingle();
          if (!emp) {
            return jsonResponse({
              error: `Item ${i}: empresa_id '${p.data.empresa_id}' não existe no cadastro`,
              codigo_status: '1',
            }, 400, corsHeaders);
          }
        }
        validItems.push(p.data);
      }

      const mapped = validItems.map(r => ({
        codigo_lancamento_integracao: r.codigo_lancamento_integracao,
        codigo_cliente_fornecedor: r.codigo_cliente_fornecedor,
        data_vencimento: parseDate(r.data_vencimento),
        valor_original: r.valor_documento || r.valor_original,
        categoria: r.codigo_categoria,
        empresa_id: r.empresa_id,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(mapped, { onConflict: 'empresa_id,codigo_lancamento_integracao' })
        .select('id');
      if (error) throw error;

      await auditLog(supabase, 'cr_api_upsert_lote', auth.userId, { count: data?.length || 0 });

      return jsonResponse({
        lote: raw.lote || 1,
        codigo_status: '0',
        descricao_status: `${data?.length || 0} registros processados com sucesso!`,
        total_processados: data?.length || 0,
      }, 200, corsHeaders);
    }

    // ========== POST /lancar-recebimento ==========
    if (path.endsWith('/lancar-recebimento') && req.method === 'POST') {
      const raw = await req.json();
      const parsed = RecebimentoSchema.safeParse(raw);
      if (!parsed.success) return zodError(parsed.error, corsHeaders);
      const body = parsed.data;

      const { data: titulo, error: findErr } = await supabase
        .from('contas_receber').select('*')
        .eq('codigo_lancamento_integracao', body.codigo_lancamento_integracao)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!titulo) return jsonResponse({ error: 'Título não encontrado' }, 404, corsHeaders);

      // Governança: não permitir recebimento em título Cancelado
      if (titulo.status === 'Cancelado') {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: 'Recebimento não permitido para títulos cancelados.',
        }, 400, corsHeaders);
      }

      // Governança: não permitir recebimento duplicado em título já liquidado
      if (titulo.status === 'Liquidado') {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: 'Título já liquidado. Cancele o recebimento anterior antes de lançar novo.',
        }, 400, corsHeaders);
      }

      const valorBaixado = body.valor + (body.juros || 0) + (body.multa || 0) - (body.desconto || 0);
      const novoRecebido = Number(titulo.valor_recebido || 0) + valorBaixado;
      const novoAberto = Math.max(0, Number(titulo.valor_original || 0) - novoRecebido);
      const liquidado = novoAberto <= 0.01;

      // Overpayment check (5% margin for fees)
      const valorOriginal = Number(titulo.valor_original || 0);
      if (valorOriginal > 0 && novoRecebido > valorOriginal * 1.05) {
        return jsonResponse({
          codigo_status: '4',
          descricao_status: `Pagamento a maior detectado. Valor acumulado (${novoRecebido.toFixed(2)}) excede 105% do original (${valorOriginal.toFixed(2)}). Use valor correto ou entre em contato.`,
        }, 400, corsHeaders);
      }

      const obs = body.observacao ? sanitizeString(body.observacao) : null;
      const { error: updErr } = await supabase
        .from('contas_receber')
        .update({
          valor_recebido: novoRecebido,
          valor_aberto: novoAberto,
          valor_juros: Number(titulo.valor_juros || 0) + (body.juros || 0),
          valor_desconto: Number(titulo.valor_desconto || 0) + (body.desconto || 0),
          data_recebimento: parseDate(body.data) || new Date().toISOString().split('T')[0],
          status: liquidado ? 'Liquidado' : titulo.status,
          observacoes: obs ? `${titulo.observacoes || ''}\n${obs}`.trim() : titulo.observacoes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', titulo.id);
      if (updErr) throw updErr;

      const codigoBaixa = crypto.randomUUID();

      await auditLog(supabase, 'cr_api_recebimento', auth.userId, {
        id: titulo.id, codigo: body.codigo_lancamento_integracao, valor: valorBaixado, liquidado,
      });

      enqueueWebhookEvent('conta_receber.recebimento', {
        id: titulo.id, codigo_lancamento_integracao: body.codigo_lancamento_integracao,
        valor_baixado: valorBaixado, liquidado,
      }, titulo.empresa_id).catch(() => {});

      return jsonResponse({
        codigo_lancamento_integracao: body.codigo_lancamento_integracao,
        codigo_baixa: codigoBaixa,
        liquidado: liquidado ? 'S' : 'N',
        valor_baixado: valorBaixado,
        codigo_status: '0', descricao_status: 'Recebimento registrado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /cancelar-recebimento (501 — not implemented) ==========
    if (path.endsWith('/cancelar-recebimento') && req.method === 'POST') {
      return jsonResponse({
        codigo_status: '99',
        descricao_status: 'Endpoint em desenvolvimento. Cancelamento de recebimento ainda não implementado.',
      }, 501, corsHeaders);
    }

    // ========== POST /conciliar (501 — not implemented) ==========
    if (path.endsWith('/conciliar') && req.method === 'POST') {
      return jsonResponse({
        codigo_status: '99',
        descricao_status: 'Endpoint em desenvolvimento. Conciliação ainda não implementada.',
      }, 501, corsHeaders);
    }

    // ========== POST /desconciliar (501 — not implemented) ==========
    if (path.endsWith('/desconciliar') && req.method === 'POST') {
      return jsonResponse({
        codigo_status: '99',
        descricao_status: 'Endpoint em desenvolvimento. Desconciliação ainda não implementada.',
      }, 501, corsHeaders);
    }

    // ========== POST /estornar (PR-3 / P3) ==========
    if (path.endsWith('/estornar') && req.method === 'POST') {
      const raw = await req.json().catch(() => ({}));
      const parsed = EstornarSchema.safeParse(raw);
      if (!parsed.success) return zodError(parsed.error, corsHeaders);
      const body = parsed.data;

      // Buscar título
      let q = supabase.from('contas_receber').select('id, status, empresa_id, codigo_lancamento_integracao, observacao');
      if (body.nCodTitulo) q = q.eq('id', body.nCodTitulo);
      else q = q.eq('codigo_lancamento_integracao', body.codigo_lancamento_integracao!);
      const { data: titulo } = await q.maybeSingle();

      if (!titulo) {
        return jsonResponse({
          codigo_status: '1',
          descricao_status: 'Título não encontrado.',
        }, 404, corsHeaders);
      }

      // Validar status: não estornar liquidado/cancelado/já estornado
      if (titulo.status === 'Liquidado') {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: 'Estorno não permitido para títulos liquidados. Cancele o recebimento primeiro.',
        }, 400, corsHeaders);
      }
      if (titulo.status === 'Cancelado') {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: 'Título já está cancelado — use cancelar ao invés de estornar.',
        }, 400, corsHeaders);
      }
      if (titulo.status === 'Estornado') {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: 'Título já está estornado.',
        }, 400, corsHeaders);
      }

      const motivo = body.cMotivo ? sanitizeString(body.cMotivo, 500) : 'Estorno via API';
      const obsAnterior = titulo.observacao || '';
      const carimbo = `[ESTORNO ${new Date().toISOString()}] ${motivo}`;
      const novaObs = obsAnterior ? `${obsAnterior}\n${carimbo}` : carimbo;

      const { error } = await supabase.from('contas_receber').update({
        status: 'Estornado',
        inativo: true,
        observacao: novaObs,
        updated_at: new Date().toISOString(),
      }).eq('id', titulo.id);
      if (error) throw error;

      await auditLog(supabase, 'cr_api_estornar', auth.userId, { id: titulo.id, motivo });
      enqueueWebhookEvent('conta_receber.estornada', {
        id: titulo.id,
        codigo_lancamento_integracao: titulo.codigo_lancamento_integracao,
        motivo,
      }, titulo.empresa_id).catch(() => {});

      return jsonResponse({
        codigo_lancamento_integracao: titulo.codigo_lancamento_integracao,
        nCodTitulo: titulo.id,
        codigo_status: '0',
        descricao_status: 'Título estornado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /cancelar ==========
    if (path.endsWith('/cancelar') && req.method === 'POST') {
      const raw = await req.json();
      const parsed = CancelarSchema.safeParse(raw);
      if (!parsed.success) return zodError(parsed.error, corsHeaders);
      const body = parsed.data;

      // Governança: buscar e verificar status
      let govQuery = supabase.from('contas_receber').select('id, status, empresa_id, codigo_lancamento_integracao');
      if (body.chave_lancamento) govQuery = govQuery.eq('id', body.chave_lancamento);
      else govQuery = govQuery.eq('codigo_lancamento_integracao', body.codigo_lancamento_integracao!);
      const { data: tituloGov } = await govQuery.maybeSingle();

      if (!tituloGov) return jsonResponse({ error: 'Registro não encontrado' }, 404, corsHeaders);

      if (tituloGov.status === 'Liquidado') {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: 'Cancelamento não permitido para títulos liquidados. Cancele o recebimento primeiro.',
        }, 400, corsHeaders);
      }

      if (tituloGov.status === 'Cancelado') {
        return jsonResponse({
          codigo_status: '3',
          descricao_status: 'Título já está cancelado.',
        }, 400, corsHeaders);
      }

      const { error } = await supabase.from('contas_receber').update({
        status: 'Cancelado', inativo: true, updated_at: new Date().toISOString(),
      }).eq('id', tituloGov.id);
      if (error) throw error;

      await auditLog(supabase, 'cr_api_cancelar', auth.userId, { id: tituloGov.id });
      enqueueWebhookEvent('conta_receber.cancelada', { id: tituloGov.id, codigo_lancamento_integracao: tituloGov.codigo_lancamento_integracao }, tituloGov.empresa_id).catch(() => {});

      return jsonResponse({
        codigo_lancamento_integracao: tituloGov.codigo_lancamento_integracao,
        codigo_status: '0', descricao_status: 'Título cancelado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== GET /listar ==========
    if (path.endsWith('/listar') && req.method === 'GET') {
      const pagina = Math.max(1, Number(url.searchParams.get('pagina') || '1'));
      const porPagina = Math.min(500, Math.max(1, Number(url.searchParams.get('registros_por_pagina') || '20')));
      const from = (pagina - 1) * porPagina;
      const to = from + porPagina - 1;

      let query = supabase.from('contas_receber').select('*', { count: 'exact' });

      const apenasApi = url.searchParams.get('apenas_importado_api');
      if (apenasApi === 'S') query = query.eq('enviado_erp', true);
      if (apenasApi === 'N') query = query.eq('enviado_erp', false);

      const status = url.searchParams.get('filtrar_por_status');
      if (status) query = query.in('status', status.split(','));

      const dataDe = url.searchParams.get('filtrar_por_data_de');
      if (dataDe) query = query.gte('data_vencimento', parseDate(dataDe));

      const dataAte = url.searchParams.get('filtrar_por_data_ate');
      if (dataAte) query = query.lte('data_vencimento', parseDate(dataAte));

      const cliente = url.searchParams.get('filtrar_cliente');
      if (cliente) query = query.eq('codigo_cliente_fornecedor', String(cliente));

      const empresaFilter = url.searchParams.get('empresa_id');
      if (empresaFilter) query = query.eq('empresa_id', Number(empresaFilter));

      const ordenar = url.searchParams.get('ordenar_por') || 'data_vencimento';
      const desc = url.searchParams.get('ordem_descrescente') === 'S';
      query = query.order(ordenar, { ascending: !desc }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return jsonResponse({
        pagina,
        total_de_paginas: Math.ceil((count || 0) / porPagina),
        registros: data?.length || 0,
        total_de_registros: count || 0,
        conta_receber_cadastro: data || [],
      }, 200, corsHeaders);
    }

    // ========== Sync endpoints (legacy — field whitelist) ==========
    if (path.endsWith('/sync') && req.method === 'POST') {
      const body = await req.json();
      const records = body.records || body.data || [];
      if (!Array.isArray(records) || records.length === 0) {
        return jsonResponse({ success: true, message: 'Nenhum registro para sincronizar', processed: 0 }, 200, corsHeaders);
      }

      const mapped = records.map((r: Record<string, unknown>) => ({
        erp_id: r.erp_id || `${r.empresa_id}-${r.tipo_documento}-${r.numero_documento}-${r.parcela}-${r.cliente_codigo}`,
        empresa_id: r.empresa_id,
        empresa_nome: r.empresa_nome ? sanitizeString(String(r.empresa_nome)) : null,
        cliente_codigo: r.cliente_codigo,
        cliente_nome: r.cliente_nome ? sanitizeString(String(r.cliente_nome)) : null,
        tipo_documento: r.tipo_documento,
        numero_documento: r.numero_documento,
        parcela: r.parcela || 1,
        data_emissao: parseDate(r.data_emissao),
        data_vencimento: parseDate(r.data_vencimento),
        data_recebimento: parseDate(r.data_recebimento),
        valor_original: r.valor_original || 0,
        valor_aberto: r.valor_aberto || 0,
        valor_recebido: r.valor_recebido || 0,
        status: r.status,
        sincronizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(mapped, { onConflict: 'erp_id' })
        .select('id');
      if (error) throw error;

      await auditLog(supabase, 'cr_api_sync', auth.userId, { count: data?.length || 0 });

      return jsonResponse({ success: true, processed: data?.length || 0, total: records.length }, 200, corsHeaders);
    }

    if (path.endsWith('/bulk-sync') && req.method === 'POST') {
      const body = await req.json();
      const records = body.records || body.data || [];
      const mapped = records.map((r: Record<string, unknown>) => ({
        erp_id: r.erp_id || `${r.empresa_id}-${r.tipo_documento}-${r.numero_documento}-${r.parcela}-${r.cliente_codigo}`,
        empresa_id: r.empresa_id,
        cliente_codigo: r.cliente_codigo,
        cliente_nome: r.cliente_nome ? sanitizeString(String(r.cliente_nome)) : null,
        tipo_documento: r.tipo_documento,
        numero_documento: r.numero_documento,
        parcela: r.parcela || 1,
        data_vencimento: parseDate(r.data_vencimento),
        valor_original: r.valor_original || 0,
        valor_aberto: r.valor_aberto || 0,
        valor_recebido: r.valor_recebido || 0,
        status: r.status,
        sincronizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(mapped, { onConflict: 'erp_id' })
        .select('id');
      if (error) throw error;

      await auditLog(supabase, 'cr_api_bulk_sync', auth.userId, { count: data?.length || 0 });

      return jsonResponse({ success: true, processed: data?.length || 0 }, 200, corsHeaders);
    }

    if (path.endsWith('/sync-status') && req.method === 'GET') {
      const { data } = await supabase
        .from('contas_receber').select('sincronizado_em')
        .order('sincronizado_em', { ascending: false }).limit(1).maybeSingle();
      return jsonResponse({ last_sync: data?.sincronizado_em || null, status: 'ok' }, 200, corsHeaders);
    }

    if (path.endsWith('/delete-old') && req.method === 'POST') {
      return jsonResponse({ success: true, message: 'Operação não implementada para segurança.' }, 200, corsHeaders);
    }

    // ========== GET / — Listar últimos 100 ==========
    if ((path.endsWith('/contas-receber-api') || path.endsWith('/contas-receber-api/')) && req.method === 'GET') {
      const { data, error } = await supabase
        .from('contas_receber').select('*')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return jsonResponse(data || [], 200, corsHeaders);
    }

    return jsonResponse({
      error: 'Rota não encontrada',
      available_routes: [
        'GET /status', 'GET /consultar', 'GET /listar',
        'POST /incluir', 'PUT /alterar', 'DELETE /excluir',
        'POST /upsert', 'POST /upsert-lote',
        'POST /lancar-recebimento', 'POST /cancelar-recebimento',
        'POST /conciliar', 'POST /desconciliar', 'POST /cancelar', 'POST /estornar',
        'POST /sync', 'POST /bulk-sync', 'GET /sync-status',
      ],
    }, 404, corsHeaders);

  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, error.status, corsHeaders);
    }
    if (error instanceof RateLimitError) {
      return jsonResponse({ error: 'Limite de requisições excedido. Tente novamente em breve.' }, 429, corsHeaders);
    }
    // Postgres constraint error handling
    const pgCode = (error as any)?.code;
    if (pgCode === '22P02') {
      return jsonResponse({ error: 'Formato inválido: verifique que campos numéricos (codigo_cliente_fornecedor, id_conta_corrente) são números, não strings.', codigo_status: '1' }, 400, corsHeaders);
    }
    if (pgCode === '23503') {
      return jsonResponse({ error: 'Referência inválida: verifique codigo_cliente_fornecedor, codigo_categoria e id_conta_corrente.', codigo_status: '1' }, 400, corsHeaders);
    }
    if (pgCode === '23505') {
      return jsonResponse({ error: 'Registro duplicado: já existe um lançamento com este código de integração.', codigo_status: '2' }, 409, corsHeaders);
    }
    if (pgCode === '23502') {
      return jsonResponse({ error: 'Campo obrigatório ausente: verifique os campos required na documentação.', codigo_status: '1' }, 400, corsHeaders);
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ contas-receber-api error:', msg);
    return jsonResponse({
      error: msg || 'Erro interno desconhecido',
      error_detail: msg,
      codigo_status: '1',
      descricao_status: `Erro interno: ${msg || 'erro desconhecido'}`,
    }, 500, corsHeaders);
  }
}
