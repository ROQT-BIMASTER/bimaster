import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

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

/**
 * Build payload based on financial_status:
 * - accepted → "Aguardando Pagamento" (provisão)
 * - paid → "Pago" (baixa)
 */
function buildCleanPayload(item: Record<string, unknown>) {
  const doc = item.supplier_document as string | null;
  const isPaid = item.financial_status === "paid";

  const payload: Record<string, unknown> = {
    api_version: "1.0",
    generated_at: new Date().toISOString(),
    id: item.id,
    empresa_id: item.empresa_id || 1,
    export_type: isPaid ? "payment" : "registration",
    fornecedor: {
      nome: item.supplier_name || null,
      documento: cleanDocument(doc),
      documento_formatado: doc || null,
    },
    documento: {
      tipo: item.document_type || null,
      numero: item.document_number || null,
    },
    departamento: item.department_name || null,
    descricao: item.description || null,
  };

  if (isPaid) {
    payload.pagamento = {
      valor: Number(item.amount) || 0,
      moeda: "BRL",
      data_vencimento: item.due_date || null,
      data_pagamento: item.paid_at || null,
      metodo: mapPaymentMethod(item.payment_method as string),
      portador: item.portador || null,
    };
    payload.status = "Pago";
  } else {
    payload.pagamento = {
      valor: Number(item.amount) || 0,
      moeda: "BRL",
      data_vencimento: item.due_date || null,
      portador: item.portador || null,
    };
    payload.status = "Aguardando Pagamento";
  }

  return payload;
}

let _currentReq: Request;

Deno.serve(async (req) => {
  _currentReq = req;
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("EXPORT_API_KEY");

  let authenticated = false;
  if (apiKey && expectedKey && timingSafeEqual(apiKey, expectedKey)) {
    authenticated = true;
  }

  // Fallback: check erp_api_keys table
  if (!authenticated && apiKey) {
    const { validateErpApiKey } = await import("../_shared/erp-key-validator.ts");
    const empresa = await validateErpApiKey(apiKey);
    if (empresa) authenticated = true;
  }

  if (!authenticated) {
    return jsonResponse({ error: "API key inválida ou ausente" }, 401);
  }

  // Rate limit
  try {
    await checkRateLimit({ prefix: "contas-pagar-export", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return jsonResponse({ error: e.message }, 429);
    }
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "GET" && path === "paid") {
      return await handleGetItems(supabase, url, "paid");
    } else if (req.method === "GET" && path === "pending") {
      return await handleGetItems(supabase, url, "accepted");
    } else if (req.method === "GET" && path === "cancelled") {
      return await handleGetCancelledItems(supabase, url);
    } else if (req.method === "POST" && path === "confirm") {
      return await handleConfirm(supabase, req);
    } else if (req.method === "GET" && path === "status") {
      return await handleStatus(supabase);
    } else if (req.method === "GET" && path === "history") {
      return await handleExportHistory(supabase, url);
    } else if (req.method === "POST" && path === "export-batch") {
      return await handleExportBatch(supabase, req);
    } else if (req.method === "POST" && path === "retry-failed") {
      return await handleRetryFailed(supabase, req);
    } else if (req.method === "GET" && path === "reconciliation") {
      return await handleReconciliation(supabase, url);
    } else if (req.method === "GET" && path === "export-summary") {
      return await handleExportSummary(supabase, url);
    } else if (req.method === "POST" && path === "webhook-push") {
      return await handleWebhookPushConfig(supabase, req);
    } else {
      if (req.method === "GET") {
        const statusParam = url.searchParams.get("status");
        if (statusParam && statusParam.split(",").map(s => s.trim()).includes("cancelado")) {
          return await handleGetCancelledItems(supabase, url);
        }
        return await handleGetItems(supabase, url, null);
      }
      return jsonResponse({
        error: "Rota não encontrada. Rotas: GET /paid, /pending, /cancelled, /status, /history, /reconciliation, /export-summary | POST /confirm, /export-batch, /retry-failed, /webhook-push",
      }, 404);
    }
  } catch (err) {
    console.error("contas-pagar-export-api error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

/**
 * GET /paid — itens pagos pendentes de exportação
 * GET /pending — itens aceitos pendentes de exportação (provisão)
 * GET / — ambos, ou filtrado por ?status=accepted,paid
 */
async function handleGetItems(
  supabase: ReturnType<typeof createClient>,
  url: URL,
  defaultStatus: string | null
) {
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Determine which statuses to fetch
  const statusParam = url.searchParams.get("status");
  let statuses: string[];

  if (defaultStatus) {
    statuses = [defaultStatus];
  } else if (statusParam) {
    statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    statuses = ["accepted", "paid"];
  }

  // Fetch items matching the requested statuses
  const { data: items, error: fetchErr } = await supabase
    .from("financial_payment_queue")
    .select("*")
    .in("financial_status", statuses)
    .order("updated_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (fetchErr) {
    return jsonResponse({ error: "Erro ao buscar itens: " + fetchErr.message }, 500);
  }

  if (!items || items.length === 0) {
    return jsonResponse({ data: [], total: 0, message: "Nenhum item encontrado" });
  }

  // Check which ones have already been exported
  const ids = items.map((i: Record<string, unknown>) => i.id);
  const { data: exportedItems } = await supabase
    .from("erp_export_queue")
    .select("payment_queue_id, export_type, export_status")
    .in("payment_queue_id", ids)
    .eq("export_status", "exported");

  // Build sets for each export type
  const registrationExported = new Set<string>();
  const paymentExported = new Set<string>();
  (exportedItems || []).forEach((e: Record<string, unknown>) => {
    if (e.export_type === "registration") registrationExported.add(e.payment_queue_id as string);
    if (e.export_type === "payment") paymentExported.add(e.payment_queue_id as string);
  });

  // Filter: accepted items not yet exported as registration, paid items not yet exported as payment
  const pendingItems = items.filter((item: Record<string, unknown>) => {
    if (item.financial_status === "accepted") {
      return !registrationExported.has(item.id as string);
    }
    if (item.financial_status === "paid") {
      return !paymentExported.has(item.id as string);
    }
    return false;
  });

  const cleanData = pendingItems.map(buildCleanPayload);

  return jsonResponse({
    data: cleanData,
    total: cleanData.length,
    offset,
    limit,
  });
}

async function handleConfirm(supabase: ReturnType<typeof createClient>, req: Request) {
  const body = await req.json();
  const { ids, export_type } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return jsonResponse({ error: "Envie um array 'ids' com os IDs dos pagamentos confirmados" }, 400);
  }

  const resolvedType = export_type || "payment";
  let confirmed = 0;
  const errors: string[] = [];

  for (const paymentId of ids) {
    const { data: existing } = await supabase
      .from("erp_export_queue")
      .select("id")
      .eq("payment_queue_id", paymentId)
      .eq("export_type", resolvedType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabase
        .from("erp_export_queue")
        .update({
          export_status: "exported",
          exported_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateErr) {
        errors.push(`${paymentId}: ${updateErr.message}`);
      } else {
        confirmed++;
      }
    } else {
      const { error: insertErr } = await supabase
        .from("erp_export_queue")
        .insert({
          payment_queue_id: paymentId,
          export_channel: "pull_api",
          export_status: "exported",
          export_type: resolvedType,
          exported_at: new Date().toISOString(),
          payload: {},
          attempts: 1,
          last_attempt_at: new Date().toISOString(),
        });

      if (insertErr) {
        errors.push(`${paymentId}: ${insertErr.message}`);
      } else {
        confirmed++;
      }
    }
  }

  return jsonResponse({
    confirmed,
    export_type: resolvedType,
    errors: errors.length > 0 ? errors : undefined,
    message: `${confirmed} item(ns) confirmado(s) como exportado(s) (${resolvedType})`,
  });
}

async function handleStatus(supabase: ReturnType<typeof createClient>) {
  // Total accepted
  const { count: totalAccepted } = await supabase
    .from("financial_payment_queue")
    .select("id", { count: "exact", head: true })
    .eq("financial_status", "accepted");

  // Total paid
  const { count: totalPaid } = await supabase
    .from("financial_payment_queue")
    .select("id", { count: "exact", head: true })
    .eq("financial_status", "paid");

  // Exported registrations
  const { count: exportedRegistrations } = await supabase
    .from("erp_export_queue")
    .select("id", { count: "exact", head: true })
    .eq("export_type", "registration")
    .eq("export_status", "exported");

  // Exported payments
  const { count: exportedPayments } = await supabase
    .from("erp_export_queue")
    .select("id", { count: "exact", head: true })
    .eq("export_type", "payment")
    .eq("export_status", "exported");

  const pendingRegistrations = Math.max(0, (totalAccepted || 0) - (exportedRegistrations || 0));
  const pendingPayments = Math.max(0, (totalPaid || 0) - (exportedPayments || 0));

  return jsonResponse({
    provisao: {
      total_aceitos: totalAccepted || 0,
      exportados: exportedRegistrations || 0,
      pendentes: pendingRegistrations,
    },
    baixa: {
      total_pagos: totalPaid || 0,
      exportados: exportedPayments || 0,
      pendentes: pendingPayments,
    },
    resumo: {
      total_pendentes_exportacao: pendingRegistrations + pendingPayments,
    },
  });
}

/**
 * GET /cancelled — títulos cancelados pendentes de exportação
 */
async function handleGetCancelledItems(
  supabase: ReturnType<typeof createClient>,
  url: URL
) {
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const { data: items, error: fetchErr } = await supabase
    .from("contas_pagar")
    .select("id, empresa_id, fornecedor_nome, fornecedor_codigo, numero_documento, tipo_documento, valor_original, data_vencimento, departamento_nome, updated_at")
    .eq("status", "cancelado")
    .order("updated_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (fetchErr) {
    return jsonResponse({ error: "Erro ao buscar cancelados: " + fetchErr.message }, 500);
  }

  if (!items || items.length === 0) {
    return jsonResponse({ data: [], total: 0, message: "Nenhum título cancelado encontrado" });
  }

  // Check which have already been exported as cancellation
  const ids = items.map((i: Record<string, unknown>) => i.id);
  const { data: exportedItems } = await supabase
    .from("erp_export_queue")
    .select("conta_pagar_id")
    .in("conta_pagar_id", ids)
    .eq("export_type", "cancellation")
    .eq("export_status", "exported");

  const exportedSet = new Set((exportedItems || []).map((e: Record<string, unknown>) => e.conta_pagar_id));
  const pendingItems = items.filter((item: Record<string, unknown>) => !exportedSet.has(item.id));

  const cleanData = pendingItems.map((item: Record<string, unknown>) => ({
    api_version: "1.0",
    generated_at: new Date().toISOString(),
    id: item.id,
    empresa_id: item.empresa_id || 1,
    export_type: "cancellation",
    fornecedor: {
      nome: item.fornecedor_nome || null,
      codigo: item.fornecedor_codigo || null,
    },
    documento: {
      tipo: item.tipo_documento || null,
      numero: item.numero_documento || null,
    },
    pagamento: {
      valor: Number(item.valor_original) || 0,
      moeda: "BRL",
      data_vencimento: item.data_vencimento || null,
    },
    departamento: item.departamento_nome || null,
    descricao: null,
    data_cancelamento: item.updated_at || null,
    status: "Cancelado",
  }));

  return jsonResponse({
    data: cleanData,
    total: cleanData.length,
    offset,
    limit,
  });
}

// ===== NEW ROUTES (added without modifying existing ones) =====

/**
 * GET /history — Histórico de exportações (erp_export_queue)
 * Params: empresa_id, export_type, status, limit, offset
 */
async function handleExportHistory(
  supabase: ReturnType<typeof createClient>,
  url: URL
) {
  const startMs = Date.now();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const exportType = url.searchParams.get("export_type");
  const status = url.searchParams.get("status");

  let query = supabase
    .from("erp_export_queue")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (exportType) query = query.eq("export_type", exportType);
  if (status) query = query.eq("export_status", status);

  const { data, error, count } = await query;
  if (error) return jsonResponse({ error: "Erro ao buscar histórico: " + error.message }, 500);

  return jsonResponse({
    data: data || [],
    total: count || 0,
    offset,
    limit,
    meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() },
  });
}

/**
 * POST /export-batch — Exportação em lote via API key
 * Body: { ids: string[], channel?: string, export_type?: string }
 */
async function handleExportBatch(
  supabase: ReturnType<typeof createClient>,
  req: Request
) {
  const startMs = Date.now();
  const body = await req.json();
  const { ids, channel, export_type } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return jsonResponse({ error: "Campo 'ids' obrigatório (array de UUIDs)" }, 400);
  }
  if (ids.length > 200) {
    return jsonResponse({ error: "Máximo de 200 itens por lote" }, 400);
  }

  const resolvedChannel = channel || "rest_api";
  const resolvedType = export_type || "payment";
  let queued = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const paymentId of ids) {
    // Check if already exported
    const { data: existing } = await supabase
      .from("erp_export_queue")
      .select("id, export_status")
      .eq("payment_queue_id", paymentId)
      .eq("export_type", resolvedType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.export_status === "exported") {
      skipped++;
      continue;
    }

    if (existing) {
      // Re-queue existing entry
      const { error: upErr } = await supabase
        .from("erp_export_queue")
        .update({
          export_status: "pending",
          export_channel: resolvedChannel,
          attempts: (existing as any).attempts ? (existing as any).attempts + 1 : 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (upErr) errors.push(`${paymentId}: ${upErr.message}`);
      else queued++;
    } else {
      // Create new queue entry
      const { error: insErr } = await supabase
        .from("erp_export_queue")
        .insert({
          payment_queue_id: paymentId,
          export_channel: resolvedChannel,
          export_type: resolvedType,
          export_status: "pending",
          payload: {},
          attempts: 0,
          last_attempt_at: new Date().toISOString(),
        });

      if (insErr) errors.push(`${paymentId}: ${insErr.message}`);
      else queued++;
    }
  }

  return jsonResponse({
    queued,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    export_type: resolvedType,
    channel: resolvedChannel,
    message: `${queued} item(ns) enfileirado(s) para exportação, ${skipped} já exportado(s)`,
    meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() },
  });
}

/**
 * POST /retry-failed — Reprocessar exportações com erro
 * Body: { ids?: string[], channel?: string }
 * Se ids omitido, reprocessa todos com status 'error'
 */
async function handleRetryFailed(
  supabase: ReturnType<typeof createClient>,
  req: Request
) {
  const startMs = Date.now();
  const body = await req.json();
  const { ids, channel } = body;
  const resolvedChannel = channel || "rest_api";

  let query = supabase
    .from("erp_export_queue")
    .select("id, payment_queue_id, export_type, attempts")
    .eq("export_status", "error");

  if (ids && Array.isArray(ids) && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { data: failedItems, error: fetchErr } = await query.limit(500);
  if (fetchErr) return jsonResponse({ error: "Erro ao buscar falhas: " + fetchErr.message }, 500);

  if (!failedItems || failedItems.length === 0) {
    return jsonResponse({ retried: 0, message: "Nenhum item com erro encontrado" });
  }

  let retried = 0;
  const errors: string[] = [];

  for (const item of failedItems) {
    const { error: upErr } = await supabase
      .from("erp_export_queue")
      .update({
        export_status: "pending",
        export_channel: resolvedChannel,
        attempts: ((item as any).attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", (item as any).id);

    if (upErr) errors.push(`${(item as any).id}: ${upErr.message}`);
    else retried++;
  }

  return jsonResponse({
    retried,
    total_errors_found: failedItems.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `${retried} item(ns) reenfileirado(s) para reprocessamento`,
    meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() },
  });
}

/**
 * GET /reconciliation — Reconciliação BiMaster ↔ ERP
 * Params: empresa_id
 */
async function handleReconciliation(
  supabase: ReturnType<typeof createClient>,
  url: URL
) {
  const startMs = Date.now();
  const empresaId = url.searchParams.get("empresa_id");

  // Total titles by status in contas_pagar
  let cpQuery = supabase
    .from("contas_pagar")
    .select("id, status, empresa_id");
  if (empresaId) cpQuery = cpQuery.eq("empresa_id", parseInt(empresaId));

  const { data: titulos, error: cpErr } = await cpQuery.limit(5000);
  if (cpErr) return jsonResponse({ error: "Erro ao buscar títulos: " + cpErr.message }, 500);

  // Get all export records
  const tituloIds = (titulos || []).map((t: any) => t.id);

  let exportQuery = supabase
    .from("erp_export_queue")
    .select("payment_queue_id, conta_pagar_id, export_type, export_status");
  
  // Filter by relevant IDs if available
  if (tituloIds.length > 0 && tituloIds.length <= 1000) {
    // Use payment_queue_id or conta_pagar_id depending on data
    exportQuery = exportQuery.or(
      `payment_queue_id.in.(${tituloIds.join(",")}),conta_pagar_id.in.(${tituloIds.join(",")})`
    );
  }

  const { data: exports } = await exportQuery.limit(5000);

  // Build reconciliation map
  const exportedIds = new Set<string>();
  const exportErrors = new Set<string>();
  const exportPending = new Set<string>();
  
  (exports || []).forEach((e: any) => {
    const refId = e.payment_queue_id || e.conta_pagar_id;
    if (e.export_status === "exported") exportedIds.add(refId);
    else if (e.export_status === "error") exportErrors.add(refId);
    else if (e.export_status === "pending") exportPending.add(refId);
  });

  // Summarize by status
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
    resumo: {
      total_titulos: totalTitulos,
      exportados: totalExported,
      com_erro: totalErrors,
      pendentes_envio: exportPending.size,
      nao_enviados: Math.max(0, totalNotSent),
      taxa_sincronizacao: totalTitulos > 0 ? Math.round((totalExported / totalTitulos) * 10000) / 100 : 0,
    },
    por_status: statusCounts,
    meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() },
  });
}

/**
 * GET /export-summary — Resumo detalhado por empresa e período
 * Params: empresa_id, periodo_de, periodo_ate
 */
async function handleExportSummary(
  supabase: ReturnType<typeof createClient>,
  url: URL
) {
  const startMs = Date.now();
  const empresaId = url.searchParams.get("empresa_id");
  const periodoDe = url.searchParams.get("periodo_de");
  const periodoAte = url.searchParams.get("periodo_ate");

  let query = supabase
    .from("erp_export_queue")
    .select("export_type, export_status, export_channel, created_at, exported_at");

  if (periodoDe) query = query.gte("created_at", periodoDe);
  if (periodoAte) query = query.lte("created_at", periodoAte + "T23:59:59Z");

  const { data: exports, error: fetchErr } = await query.limit(5000);
  if (fetchErr) return jsonResponse({ error: "Erro ao buscar resumo: " + fetchErr.message }, 500);

  // Aggregate
  const byType: Record<string, Record<string, number>> = {};
  const byChannel: Record<string, number> = {};
  let totalExported = 0;
  let totalPending = 0;
  let totalError = 0;

  (exports || []).forEach((e: any) => {
    const type = e.export_type || "unknown";
    const status = e.export_status || "unknown";
    const channel = e.export_channel || "unknown";

    if (!byType[type]) byType[type] = {};
    byType[type][status] = (byType[type][status] || 0) + 1;
    byChannel[channel] = (byChannel[channel] || 0) + 1;

    if (status === "exported") totalExported++;
    else if (status === "pending") totalPending++;
    else if (status === "error") totalError++;
  });

  return jsonResponse({
    empresa_id: empresaId || "todas",
    periodo: {
      de: periodoDe || "início",
      ate: periodoAte || "hoje",
    },
    resumo: {
      total_registros: (exports || []).length,
      exportados: totalExported,
      pendentes: totalPending,
      com_erro: totalError,
    },
    por_tipo: byType,
    por_canal: byChannel,
    meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() },
  });
}

/**
 * POST /webhook-push — Configurar webhook outbound para push automático
 * Body: { webhook_url: string, events: string[], secret?: string }
 */
async function handleWebhookPushConfig(
  supabase: ReturnType<typeof createClient>,
  req: Request
) {
  const startMs = Date.now();
  const body = await req.json();
  const { webhook_url, events, secret, empresa_id } = body;

  if (!webhook_url || typeof webhook_url !== "string") {
    return jsonResponse({ error: "Campo 'webhook_url' obrigatório" }, 400);
  }

  // Validate URL format
  try {
    const parsed = new URL(webhook_url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return jsonResponse({ error: "webhook_url deve usar HTTP ou HTTPS" }, 400);
    }
  } catch {
    return jsonResponse({ error: "webhook_url inválida" }, 400);
  }

  if (!events || !Array.isArray(events) || events.length === 0) {
    return jsonResponse({ error: "Campo 'events' obrigatório (array: accepted, paid, cancelled)" }, 400);
  }

  const validEvents = ["accepted", "paid", "cancelled", "registration", "payment", "cancellation"];
  const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return jsonResponse({ error: `Eventos inválidos: ${invalidEvents.join(", ")}. Válidos: ${validEvents.join(", ")}` }, 400);
  }

  // Store webhook config in erp_config
  const configData = {
    config_key: "webhook_push",
    config_value: JSON.stringify({
      webhook_url,
      events,
      secret: secret || null,
      registered_at: new Date().toISOString(),
    }),
    empresa_id: empresa_id ? parseInt(empresa_id) : 1,
    ativo: true,
  };

  const { error: upsertErr } = await supabase
    .from("erp_config")
    .upsert(configData, { onConflict: "config_key,empresa_id" });

  if (upsertErr) {
    // Fallback: insert if upsert fails
    const { error: insertErr } = await supabase
      .from("erp_config")
      .insert(configData);
    
    if (insertErr) {
      return jsonResponse({ error: "Erro ao salvar configuração: " + insertErr.message }, 500);
    }
  }

  return jsonResponse({
    message: "Webhook configurado com sucesso",
    webhook_url,
    events,
    empresa_id: empresa_id || 1,
    meta: { duration_ms: Date.now() - startMs, processed_at: new Date().toISOString() },
  });
}

function jsonResponse(data: unknown, status = 200) {
  const cors = _currentReq ? getCorsHeaders(_currentReq) : {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    status === 401 || status === 403
  );
  return new Response(JSON.stringify(data), { status, headers });
}
