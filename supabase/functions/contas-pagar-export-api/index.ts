// contas-pagar-export-api/index.ts — Refactored with Zod validation + no _currentReq race condition.
// PR-15 / Onda 4 (v3.1.7): fonte oficial dos endpoints /pending /paid /status é `contas_pagar`
// (financial_payment_queue era o módulo legado e está vazio). A coluna `payment_queue_id` em
// `erp_export_queue` agora armazena o UUID de `contas_pagar.id` (decisão arquitetural PR-15:
// reuso semântico evita migration; tabela estava sem registros). NUNCA referenciar a coluna
// `conta_pagar_id` em `erp_export_queue` — ela não existe (causa PGRST204).
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { z } from "https://esm.sh/zod@3.22.4";

// =====================================================
// Zod Schemas for POST endpoints (Fase 3)
// =====================================================
const ConfirmSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  export_type: z.string().max(50).optional(),
}).strict();

const ExportBatchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  channel: z.string().max(50).optional(),
  export_type: z.string().max(50).optional(),
}).strict();

const RetryFailedSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500).optional(),
  channel: z.string().max(50).optional(),
}).strict();

const WebhookPushSchema = z.object({
  webhook_url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(),
  empresa_id: z.union([z.string(), z.number()]).optional(),
}).strict();

// =====================================================
// Helpers — req passed explicitly (no global)
// =====================================================
function mapPaymentMethod(method: string | null): string {
  if (!method) return "Não informado";
  const map: Record<string, string> = {
    pix: "PIX", pix_code: "PIX", "2": "PIX",
    ted: "TED", transferencia: "Transferência Bancária", transfer: "Transferência Bancária",
    boleto: "Boleto", "1": "Boleto", cartao: "Cartão",
    credit_card: "Cartão de Crédito", debit_card: "Cartão de Débito",
    dinheiro: "Dinheiro", cash: "Dinheiro", cheque: "Cheque",
  };
  return map[(method || "").toLowerCase().trim()] || method;
}

function cleanDocument(doc: string | null): string | null {
  if (!doc) return null;
  return doc.replace(/[^\d]/g, "");
}

function buildCleanPayload(item: Record<string, unknown>) {
  const doc = item.supplier_document as string | null;
  const isPaid = item.financial_status === "paid";

  const payload: Record<string, unknown> = {
    api_version: "1.0", generated_at: new Date().toISOString(),
    id: item.id, empresa_id: item.empresa_id || 1,
    export_type: isPaid ? "payment" : "registration",
    fornecedor: { nome: item.supplier_name || null, documento: cleanDocument(doc), documento_formatado: doc || null },
    documento: { tipo: item.document_type || null, numero: item.document_number || null },
    departamento: item.department_name || null, descricao: item.description || null,
  };

  if (isPaid) {
    payload.pagamento = { valor: Number(item.amount) || 0, moeda: "BRL", data_vencimento: item.due_date || null, data_pagamento: item.paid_at || null, metodo: mapPaymentMethod(item.payment_method as string), portador: item.portador || null };
    payload.status = "Pago";
  } else {
    payload.pagamento = { valor: Number(item.amount) || 0, moeda: "BRL", data_vencimento: item.due_date || null, portador: item.portador || null };
    payload.status = "Aguardando Pagamento";
  }

  return payload;
}

function jsonResponse(data: unknown, status: number, req: Request) {
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders({ ...cors, "Content-Type": "application/json" }, status === 401 || status === 403);
  return new Response(JSON.stringify(data), { status, headers });
}

function zodError(parsed: z.SafeParseError<any>, req: Request): Response {
  return jsonResponse({
    error: "payload_invalido",
    details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
  }, 400, req);
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Health check — before auth
  {
    const url = new URL(req.url);
    const p = url.pathname.split("/").pop();
    if (req.method === "GET" && p === "status") {
      return jsonResponse({ status: "ok", service: "contas-pagar-export-api", version: "1.0.0" }, 200, req);
    }
  }

  // Auth
  try {
    await validateAnyAuth(req);
  } catch (e) {
    if (e instanceof AuthError) return jsonResponse({ error: e.message }, e.status, req);
    return jsonResponse({ error: "API key inválida ou ausente" }, 401, req);
  }

  // Rate limit
  try {
    await checkRateLimit({ prefix: "contas-pagar-export", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonResponse({ error: e.message }, 429, req);
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "GET" && path === "paid") return await handleGetItems(supabase, url, "paid", req);
    if (req.method === "GET" && path === "pending") return await handleGetItems(supabase, url, "accepted", req);
    if (req.method === "GET" && path === "cancelled") return await handleGetCancelledItems(supabase, url, req);
    if (req.method === "POST" && path === "confirm") return await handleConfirm(supabase, req);
    if (req.method === "GET" && path === "status") return await handleStatusDetail(supabase, req);
    if (req.method === "GET" && path === "history") return await handleExportHistory(supabase, url, req);
    if (req.method === "POST" && path === "export-batch") return await handleExportBatch(supabase, req);
    if (req.method === "POST" && path === "retry-failed") return await handleRetryFailed(supabase, req);
    if (req.method === "GET" && path === "reconciliation") return await handleReconciliation(supabase, url, req);
    if (req.method === "GET" && path === "export-summary") return await handleExportSummary(supabase, url, req);
    if (req.method === "POST" && path === "webhook-push") return await handleWebhookPushConfig(supabase, req);

    if (req.method === "GET") {
      const statusParam = url.searchParams.get("status");
      if (statusParam && statusParam.split(",").map(s => s.trim()).includes("cancelado")) {
        return await handleGetCancelledItems(supabase, url, req);
      }
      return await handleGetItems(supabase, url, null, req);
    }

    return jsonResponse({
      error: "Rota não encontrada. Rotas: GET /paid, /pending, /cancelled, /status, /history, /reconciliation, /export-summary | POST /confirm, /export-batch, /retry-failed, /webhook-push",
    }, 404, req);
  } catch (err) {
    console.error("contas-pagar-export-api error:", err);
    return jsonResponse({ error: (err as Error).message }, 500, req);
  }
});

// =====================================================
// GET handlers — req passed explicitly
// =====================================================
async function handleGetItems(supabase: ReturnType<typeof createClient>, url: URL, defaultStatus: string | null, req: Request) {
  // PR-15: fonte é `contas_pagar`. defaultStatus 'accepted' → status='pendente'; 'paid' → 'pago'.
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const empresaId = url.searchParams.get("empresa_id");

  const statusMap: Record<string, string> = { accepted: "pendente", paid: "pago" };
  const exportTypeMap: Record<string, string> = { pendente: "registration", pago: "payment" };

  let cpStatuses: string[];
  if (defaultStatus && statusMap[defaultStatus]) {
    cpStatuses = [statusMap[defaultStatus]];
  } else {
    const statusParam = url.searchParams.get("status");
    if (statusParam) {
      cpStatuses = statusParam.split(",").map(s => s.trim()).filter(Boolean).map(s => statusMap[s] || s);
    } else {
      cpStatuses = ["pendente", "pago"];
    }
  }

  let cpQuery = supabase.from("contas_pagar")
    .select("id, empresa_id, status, fornecedor_nome, fornecedor_codigo, codigo_cliente_fornecedor_integracao, numero_documento, tipo_documento, valor_original, valor_aberto, valor_pago, data_vencimento, data_pagamento, data_emissao, departamento_nome, categoria_codigo, categoria_nome, portador, conta, updated_at, codigo_lancamento_integracao")
    .in("status", cpStatuses)
    .order("updated_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (empresaId) cpQuery = cpQuery.eq("empresa_id", parseInt(empresaId));

  const { data: items, error: fetchErr } = await cpQuery;
  if (fetchErr) return jsonResponse({ error: "Erro ao buscar títulos: " + fetchErr.message }, 500, req);
  if (!items || items.length === 0) return jsonResponse({ data: [], total: 0, offset, limit, message: "Nenhum item encontrado" }, 200, req);

  const ids = items.map((i: Record<string, unknown>) => i.id);
  const { data: exportedItems } = await supabase.from("erp_export_queue")
    .select("payment_queue_id, export_type, export_status")
    .in("payment_queue_id", ids)
    .eq("export_status", "exported");

  const exportedByType: Record<string, Set<string>> = { registration: new Set(), payment: new Set() };
  (exportedItems || []).forEach((e: Record<string, unknown>) => {
    const t = e.export_type as string;
    if (exportedByType[t]) exportedByType[t].add(e.payment_queue_id as string);
  });

  const pendingItems = items.filter((item: Record<string, unknown>) => {
    const expectedType = exportTypeMap[item.status as string];
    if (!expectedType) return false;
    return !exportedByType[expectedType].has(item.id as string);
  });

  const cleanData = pendingItems.map((item: Record<string, unknown>) => {
    const isPago = item.status === "pago";
    const expType = isPago ? "payment" : "registration";
    return {
      api_version: "1.0",
      generated_at: new Date().toISOString(),
      id: item.id,
      empresa_id: item.empresa_id || 1,
      export_type: expType,
      fornecedor: {
        nome: item.fornecedor_nome || null,
        codigo: item.fornecedor_codigo || item.codigo_cliente_fornecedor_integracao || null,
      },
      documento: {
        tipo: item.tipo_documento || null,
        numero: item.numero_documento || null,
        codigo_lancamento_integracao: item.codigo_lancamento_integracao || null,
      },
      pagamento: isPago ? {
        valor: Number(item.valor_original) || 0,
        valor_pago: Number(item.valor_pago) || 0,
        moeda: "BRL",
        data_vencimento: item.data_vencimento || null,
        data_pagamento: item.data_pagamento || null,
        portador: item.portador || null,
        conta: item.conta || null,
      } : {
        valor: Number(item.valor_original) || 0,
        valor_aberto: Number(item.valor_aberto) || Number(item.valor_original) || 0,
        moeda: "BRL",
        data_vencimento: item.data_vencimento || null,
        portador: item.portador || null,
      },
      categoria: { codigo: item.categoria_codigo || null, nome: item.categoria_nome || null },
      departamento: item.departamento_nome || null,
      status: isPago ? "Pago" : "Aguardando Pagamento",
    };
  });

  return jsonResponse({ data: cleanData, total: cleanData.length, offset, limit }, 200, req);
}

async function handleGetCancelledItems(supabase: ReturnType<typeof createClient>, url: URL, req: Request) {
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const empresaId = url.searchParams.get("empresa_id");

  let cpQuery = supabase.from("contas_pagar")
    .select("id, empresa_id, fornecedor_nome, fornecedor_codigo, numero_documento, tipo_documento, valor_original, data_vencimento, departamento_nome, updated_at")
    .eq("status", "cancelado")
    .order("updated_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (empresaId) cpQuery = cpQuery.eq("empresa_id", parseInt(empresaId));

  const { data: items, error: fetchErr } = await cpQuery;
  if (fetchErr) return jsonResponse({ error: "Erro ao buscar cancelados: " + fetchErr.message }, 500, req);
  if (!items || items.length === 0) return jsonResponse({ data: [], total: 0, offset, limit, message: "Nenhum título cancelado encontrado" }, 200, req);

  const ids = items.map((i: Record<string, unknown>) => i.id);
  // PR-15: usar payment_queue_id (única coluna real). conta_pagar_id NÃO existe em erp_export_queue (causaria PGRST204).
  const { data: exportedItems } = await supabase.from("erp_export_queue")
    .select("payment_queue_id")
    .in("payment_queue_id", ids)
    .eq("export_type", "cancellation")
    .eq("export_status", "exported");

  const exportedSet = new Set((exportedItems || []).map((e: Record<string, unknown>) => e.payment_queue_id));
  const pendingItems = items.filter((item: Record<string, unknown>) => !exportedSet.has(item.id));

  const cleanData = pendingItems.map((item: Record<string, unknown>) => ({
    api_version: "1.0", generated_at: new Date().toISOString(), id: item.id, empresa_id: item.empresa_id || 1,
    export_type: "cancellation",
    fornecedor: { nome: item.fornecedor_nome || null, codigo: item.fornecedor_codigo || null },
    documento: { tipo: item.tipo_documento || null, numero: item.numero_documento || null },
    pagamento: { valor: Number(item.valor_original) || 0, moeda: "BRL", data_vencimento: item.data_vencimento || null },
    departamento: item.departamento_nome || null, descricao: null, data_cancelamento: item.updated_at || null, status: "Cancelado",
  }));

  return jsonResponse({ data: cleanData, total: cleanData.length, offset, limit }, 200, req);
}

// =====================================================
// POST handlers — with Zod validation
// =====================================================
async function handleConfirm(supabase: ReturnType<typeof createClient>, req: Request) {
  const body = await req.json();
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed, req);

  const { ids, export_type } = parsed.data;
  const resolvedType = export_type || "payment";
  let confirmed = 0;
  const errors: string[] = [];

  for (const paymentId of ids) {
    const { data: existing } = await supabase.from("erp_export_queue").select("id").eq("payment_queue_id", paymentId).eq("export_type", resolvedType).order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabase.from("erp_export_queue").update({ export_status: "exported", exported_at: new Date().toISOString() }).eq("id", existing.id);
      if (updateErr) errors.push(`${paymentId}: ${updateErr.message}`); else confirmed++;
    } else {
      const { error: insertErr } = await supabase.from("erp_export_queue").insert({
        payment_queue_id: paymentId, export_channel: "pull_api", export_status: "exported", export_type: resolvedType,
        exported_at: new Date().toISOString(), payload: {}, attempts: 1, last_attempt_at: new Date().toISOString(),
      });
      if (insertErr) errors.push(`${paymentId}: ${insertErr.message}`); else confirmed++;
    }
  }

  return jsonResponse({ confirmed, export_type: resolvedType, errors: errors.length > 0 ? errors : undefined, message: `${confirmed} item(ns) confirmado(s) como exportado(s) (${resolvedType})` }, 200, req);
}

async function handleStatusDetail(supabase: ReturnType<typeof createClient>, req: Request) {
  // PR-15: contar contas_pagar (fonte real) e subtrair os já exportados em erp_export_queue.
  const { count: totalAccepted } = await supabase.from("contas_pagar").select("id", { count: "exact", head: true }).eq("status", "pendente");
  const { count: totalPaid } = await supabase.from("contas_pagar").select("id", { count: "exact", head: true }).eq("status", "pago");
  const { count: totalCancelled } = await supabase.from("contas_pagar").select("id", { count: "exact", head: true }).eq("status", "cancelado");
  const { count: exportedRegistrations } = await supabase.from("erp_export_queue").select("id", { count: "exact", head: true }).eq("export_type", "registration").eq("export_status", "exported");
  const { count: exportedPayments } = await supabase.from("erp_export_queue").select("id", { count: "exact", head: true }).eq("export_type", "payment").eq("export_status", "exported");
  const { count: exportedCancellations } = await supabase.from("erp_export_queue").select("id", { count: "exact", head: true }).eq("export_type", "cancellation").eq("export_status", "exported");

  const pendingRegistrations = Math.max(0, (totalAccepted || 0) - (exportedRegistrations || 0));
  const pendingPayments = Math.max(0, (totalPaid || 0) - (exportedPayments || 0));
  const pendingCancellations = Math.max(0, (totalCancelled || 0) - (exportedCancellations || 0));

  return jsonResponse({
    provisao: { total_aceitos: totalAccepted || 0, exportados: exportedRegistrations || 0, pendentes: pendingRegistrations },
    baixa: { total_pagos: totalPaid || 0, exportados: exportedPayments || 0, pendentes: pendingPayments },
    cancelamento: { total_cancelados: totalCancelled || 0, exportados: exportedCancellations || 0, pendentes: pendingCancellations },
    resumo: { total_pendentes_exportacao: pendingRegistrations + pendingPayments + pendingCancellations },
  }, 200, req);
}

async function handleExportHistory(supabase: ReturnType<typeof createClient>, url: URL, req: Request) {
  const startMs = Date.now();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const exportType = url.searchParams.get("export_type");
  const status = url.searchParams.get("status");

  let query = supabase.from("erp_export_queue").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (exportType) query = query.eq("export_type", exportType);
  if (status) query = query.eq("export_status", status);

  const { data, error, count } = await query;
  if (error) return jsonResponse({ error: "Erro ao buscar histórico: " + error.message }, 500, req);

  return jsonResponse({ data: data || [], total: count || 0, offset, limit, meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() } }, 200, req);
}

async function handleExportBatch(supabase: ReturnType<typeof createClient>, req: Request) {
  const startMs = Date.now();
  const body = await req.json();
  const parsed = ExportBatchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed, req);

  const { ids, channel, export_type } = parsed.data;
  const resolvedChannel = channel || "rest_api";
  const resolvedType = export_type || "payment";
  let queued = 0, skipped = 0;
  const errors: string[] = [];

  // PR-15: validar em batch que cada id existe em contas_pagar antes de enfileirar.
  // Sem isso, FK 23503 ou silêncio para UUIDs aleatórios.
  const { data: existsRows } = await supabase.from("contas_pagar").select("id").in("id", ids);
  const existsSet = new Set((existsRows || []).map((r: Record<string, unknown>) => r.id as string));
  const missingIds = ids.filter(id => !existsSet.has(id));
  for (const m of missingIds) errors.push(`${m}: título não encontrado em contas_pagar`);
  const validIds = ids.filter(id => existsSet.has(id));

  for (const paymentId of validIds) {
    const { data: existing } = await supabase.from("erp_export_queue").select("id, export_status, attempts").eq("payment_queue_id", paymentId).eq("export_type", resolvedType).order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (existing?.export_status === "exported") { skipped++; continue; }

    if (existing) {
      const { error: upErr } = await supabase.from("erp_export_queue").update({ export_status: "pending", export_channel: resolvedChannel, attempts: ((existing as any).attempts || 0) + 1, last_attempt_at: new Date().toISOString() }).eq("id", existing.id);
      if (upErr) errors.push(`${paymentId}: ${upErr.message}`); else queued++;
    } else {
      const { error: insErr } = await supabase.from("erp_export_queue").insert({ payment_queue_id: paymentId, export_channel: resolvedChannel, export_type: resolvedType, export_status: "pending", payload: {}, attempts: 0, last_attempt_at: new Date().toISOString() });
      if (insErr) errors.push(`${paymentId}: ${insErr.message}`); else queued++;
    }
  }

  return jsonResponse({ queued, skipped, errors: errors.length > 0 ? errors : undefined, export_type: resolvedType, channel: resolvedChannel, message: `${queued} item(ns) enfileirado(s) para exportação, ${skipped} já exportado(s)`, meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() } }, 200, req);
}

async function handleRetryFailed(supabase: ReturnType<typeof createClient>, req: Request) {
  const startMs = Date.now();
  const body = await req.json();
  const parsed = RetryFailedSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed, req);

  const { ids, channel } = parsed.data;
  const resolvedChannel = channel || "rest_api";

  let query = supabase.from("erp_export_queue").select("id, payment_queue_id, export_type, attempts").eq("export_status", "error");
  if (ids && ids.length > 0) query = query.in("id", ids);

  const { data: failedItems, error: fetchErr } = await query.limit(500);
  if (fetchErr) return jsonResponse({ error: "Erro ao buscar falhas: " + fetchErr.message }, 500, req);
  if (!failedItems || failedItems.length === 0) return jsonResponse({ retried: 0, message: "Nenhum item com erro encontrado" }, 200, req);

  let retried = 0;
  const errors: string[] = [];

  for (const item of failedItems) {
    const { error: upErr } = await supabase.from("erp_export_queue").update({ export_status: "pending", export_channel: resolvedChannel, attempts: ((item as any).attempts || 0) + 1, last_attempt_at: new Date().toISOString(), error_message: null }).eq("id", (item as any).id);
    if (upErr) errors.push(`${(item as any).id}: ${upErr.message}`); else retried++;
  }

  return jsonResponse({ retried, total_errors_found: failedItems.length, errors: errors.length > 0 ? errors : undefined, message: `${retried} item(ns) reenfileirado(s) para reprocessamento`, meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() } }, 200, req);
}

async function handleReconciliation(supabase: ReturnType<typeof createClient>, url: URL, req: Request) {
  const startMs = Date.now();
  const empresaId = url.searchParams.get("empresa_id");

  let cpQuery = supabase.from("contas_pagar").select("id, status, empresa_id");
  if (empresaId) cpQuery = cpQuery.eq("empresa_id", parseInt(empresaId));
  const { data: titulos, error: cpErr } = await cpQuery.limit(5000);
  if (cpErr) return jsonResponse({ error: "Erro ao buscar títulos: " + cpErr.message }, 500, req);

  const tituloIds = (titulos || []).map((t: any) => t.id);

  // PR-15: erp_export_queue NÃO tem coluna conta_pagar_id (causaria PGRST204).
  // payment_queue_id armazena o UUID de contas_pagar.id (decisão arquitetural PR-15).
  let exportQuery = supabase.from("erp_export_queue").select("payment_queue_id, export_type, export_status");
  if (tituloIds.length > 0 && tituloIds.length <= 1000) {
    exportQuery = exportQuery.in("payment_queue_id", tituloIds);
  }
  const { data: exports } = await exportQuery.limit(5000);

  const exportedIds = new Set<string>(), exportErrors = new Set<string>(), exportPending = new Set<string>();
  (exports || []).forEach((e: any) => {
    const refId = e.payment_queue_id;
    if (!refId) return;
    if (e.export_status === "exported") exportedIds.add(refId);
    else if (e.export_status === "error") exportErrors.add(refId);
    else if (e.export_status === "pending") exportPending.add(refId);
  });

  const statusCounts: Record<string, { total: number; exported: number; pending_export: number; error: number; not_sent: number }> = {};
  (titulos || []).forEach((t: any) => {
    const st = t.status || "desconhecido";
    if (!statusCounts[st]) statusCounts[st] = { total: 0, exported: 0, pending_export: 0, error: 0, not_sent: 0 };
    statusCounts[st].total++;
    if (exportedIds.has(t.id)) statusCounts[st].exported++;
    else if (exportErrors.has(t.id)) statusCounts[st].error++;
    else if (exportPending.has(t.id)) statusCounts[st].pending_export++;
    else statusCounts[st].not_sent++;
  });

  const totalTitulos = (titulos || []).length;
  const totalExported = exportedIds.size;
  const totalErrors = exportErrors.size;
  const totalNotSent = totalTitulos - totalExported - totalErrors - exportPending.size;

  return jsonResponse({
    empresa_id: empresaId || "todas",
    resumo: { total_titulos: totalTitulos, exportados: totalExported, com_erro: totalErrors, pendentes_envio: exportPending.size, nao_enviados: Math.max(0, totalNotSent), taxa_sincronizacao: totalTitulos > 0 ? Math.round((totalExported / totalTitulos) * 10000) / 100 : 0 },
    por_status: statusCounts,
    meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() },
  }, 200, req);
}

async function handleExportSummary(supabase: ReturnType<typeof createClient>, url: URL, req: Request) {
  const startMs = Date.now();
  const periodoDe = url.searchParams.get("periodo_de");
  const periodoAte = url.searchParams.get("periodo_ate");
  const empresaId = url.searchParams.get("empresa_id");

  let query = supabase.from("erp_export_queue").select("export_type, export_status, export_channel, created_at, exported_at");
  if (periodoDe) query = query.gte("created_at", periodoDe);
  if (periodoAte) query = query.lte("created_at", periodoAte + "T23:59:59Z");

  const { data: exports, error: fetchErr } = await query.limit(5000);
  if (fetchErr) return jsonResponse({ error: "Erro ao buscar resumo: " + fetchErr.message }, 500, req);

  const byType: Record<string, Record<string, number>> = {};
  const byChannel: Record<string, number> = {};
  let totalExported = 0, totalPending = 0, totalError = 0;

  (exports || []).forEach((e: any) => {
    const type = e.export_type || "unknown", status = e.export_status || "unknown", channel = e.export_channel || "unknown";
    if (!byType[type]) byType[type] = {};
    byType[type][status] = (byType[type][status] || 0) + 1;
    byChannel[channel] = (byChannel[channel] || 0) + 1;
    if (status === "exported") totalExported++;
    else if (status === "pending") totalPending++;
    else if (status === "error") totalError++;
  });

  return jsonResponse({
    empresa_id: empresaId || "todas",
    periodo: { de: periodoDe || "início", ate: periodoAte || "hoje" },
    resumo: { total_registros: (exports || []).length, exportados: totalExported, pendentes: totalPending, com_erro: totalError },
    por_tipo: byType, por_canal: byChannel,
    meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() },
  }, 200, req);
}

async function handleWebhookPushConfig(supabase: ReturnType<typeof createClient>, req: Request) {
  const startMs = Date.now();
  const body = await req.json();
  const parsed = WebhookPushSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed, req);

  const { webhook_url, events, secret, empresa_id } = parsed.data;

  const validEvents = ["accepted", "paid", "cancelled", "registration", "payment", "cancellation"];
  const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return jsonResponse({ error: `Eventos inválidos: ${invalidEvents.join(", ")}. Válidos: ${validEvents.join(", ")}` }, 400, req);
  }

  const configData = {
    config_key: "webhook_push",
    config_value: JSON.stringify({ webhook_url, events, secret: secret || null, registered_at: new Date().toISOString() }),
    empresa_id: empresa_id ? parseInt(String(empresa_id)) : 1,
    ativo: true,
  };

  const { error: upsertErr } = await supabase.from("erp_config").upsert(configData, { onConflict: "config_key,empresa_id" });
  if (upsertErr) {
    const { error: insertErr } = await supabase.from("erp_config").insert(configData);
    if (insertErr) return jsonResponse({ error: "Erro ao salvar configuração: " + insertErr.message }, 500, req);
  }

  return jsonResponse({ message: "Webhook configurado com sucesso", webhook_url, events, empresa_id: empresa_id || 1, meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() } }, 200, req);
}
