import { logger } from "../_shared/logger.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { z, validateBody, ValidationError } from "../_shared/validate.ts";
import { withIdempotency } from "../_shared/idempotency.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getAtrioToken, atrioHeaders } from "../_shared/atrio-auth.ts";

// ── Schemas ─────────────────────────────────────────────────────────────────

const ExportSchema = z.object({
  action: z.enum(["export", "retry", "status"]),
  payment_queue_id: z.string().uuid().optional(),
  export_queue_id:  z.string().uuid().optional(),
  empresa_id:       z.number().int().min(1).max(11).optional(),
  conta_id:         z.number().int().positive().optional(),
  observacao:       z.string().max(80).optional(),
  // canal legado mantido para compatibilidade com retry de registros antigos
  channel:          z.enum(["n8n", "rest_api", "sql_direct", "atrio"]).optional(),
  export_type:      z.enum(["registration", "payment"]).optional(),
}).strict().refine(d => {
  if (d.action === "export" && !d.payment_queue_id) return false;
  if (d.action === "retry"  && !d.export_queue_id)  return false;
  if (d.action === "status" && !d.payment_queue_id) return false;
  return true;
}, { message: "payment_queue_id ou export_queue_id obrigatório conforme action" });

// ── Mapeamento forma de pagamento → código int32 Atrio ───────────────────────

const FORMA_PAGAMENTO_MAP: Record<string, number> = {
  pix:           9,
  PIX:           9,
  ted:           2,
  TED:           2,
  transferencia: 2,
  boleto:        1,
  Boleto:        1,
  doc:           3,
  DOC:           3,
  debito:        7,
  "Débito Automático": 7,
  cartao:        11,
  Cartão:        11,
  dinheiro:      1,  // fallback
  cheque:        1,
};

function toAtrioFormaPagamento(label: string | null): number {
  if (!label) return 1;
  return FORMA_PAGAMENTO_MAP[label] ?? FORMA_PAGAMENTO_MAP[label.toLowerCase()] ?? 1;
}

// ── Entry point ──────────────────────────────────────────────────────────────

// auth: "jwt" — corrige auth: "none" anterior. ErpExportStatusBadge e demais
// callers usam supabase.functions.invoke que envia JWT automaticamente.
Deno.serve(secureHandler({ auth: "jwt", rateLimit: 30, rateLimitPrefix: "erp-export-payment" }, async (req, ctx) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method === "POST") {
    return await withIdempotency(req, "/erp-export-payment", async (cached) => {
      if (cached) return cached;
      return await runExport(req, ctx);
    });
  }
  return await runExport(req, ctx);
}));

// ── Dispatcher ───────────────────────────────────────────────────────────────

async function runExport(req: Request, ctx: any): Promise<Response> {
  const startMs = Date.now();
  const requestId = crypto.randomUUID();

  try {
    if (req.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", `Método ${req.method} não suportado.`, req, startMs);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let raw: unknown;
    try { raw = await req.json(); }
    catch {
      return errorResponse(400, "INVALID_JSON", "Corpo não é JSON válido.", req, startMs);
    }

    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return errorResponse(400, "INVALID_PAYLOAD", "Payload deve ser um objeto JSON.", req, startMs);
    }

    const body = validateBody(raw, ExportSchema);

    if (body.action === "export") {
      return await handleExport(supabase, body, ctx, req, startMs);
    }
    if (body.action === "retry") {
      return await handleRetry(supabase, body.export_queue_id!, req, startMs);
    }
    if (body.action === "status") {
      return await handleStatus(supabase, body.payment_queue_id!, req, startMs);
    }

    return errorResponse(400, "INVALID_ACTION", "action deve ser 'export', 'retry' ou 'status'", req, startMs);

  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      const details = (err as any).issues;
      return new Response(
        JSON.stringify({ error: "validation_error", message: err.message || "Payload inválido", details, request_id: requestId }),
        { status: 400, headers: { "Content-Type": "application/json", "X-Request-ID": requestId } }
      );
    }
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    const message = (err instanceof Error) ? err.message : "Erro interno inesperado";
    logger.error(`[erp-export-payment][${requestId}] internal error:`, err);
    return new Response(
      JSON.stringify({ error: "internal_error", message, request_id: requestId }),
      { status: 500, headers: { "Content-Type": "application/json", "X-Request-ID": requestId } }
    );
  }
}

// ── action: "export" — fluxo Atrio completo ──────────────────────────────────

async function handleExport(
  supabase: any,
  body: z.infer<typeof ExportSchema>,
  ctx: any,
  req: Request,
  startMs: number
): Promise<Response> {
  const { payment_queue_id, empresa_id, conta_id, observacao = "" } = body;

  // 1. Buscar item da fila com dados do fornecedor
  const { data: item, error: fetchErr } = await supabase
    .from("financial_payment_queue")
    .select("*, contas_pagar!inner(id, atrio_numero, atrio_tipo, atrio_sequencia, atrio_fornecedor_id, empresa_id, valor_aberto, data_emissao, data_vencimento)")
    .eq("id", payment_queue_id)
    .maybeSingle();

  if (fetchErr) return errorResponse(500, "DB_ERROR", fetchErr.message, req, startMs);
  if (!item)    return errorResponse(404, "payment_queue_not_found", `payment_queue_id=${payment_queue_id} não encontrado`, req, startMs);

  const cp = item.contas_pagar;
  const resolvedEmpresaId: number = empresa_id ?? cp?.empresa_id ?? 1;
  const resolvedContaId: number | null = conta_id ?? null;

  // 2. Verificar se já existe exportação bem-sucedida (idempotência)
  const { data: existingExport } = await supabase
    .from("erp_export_queue")
    .select("id, export_status")
    .eq("payment_queue_id", payment_queue_id)
    .eq("export_status", "success")
    .maybeSingle();

  if (existingExport) {
    return jsonResponse({ success: true, message: "Exportação já realizada (idempotente)", export_id: existingExport.id }, 200, req, { startMs });
  }

  // 3. Criar registro de exportação pendente para rastreabilidade
  const { data: exportRecord, error: insertErr } = await supabase
    .from("erp_export_queue")
    .insert({
      payment_queue_id,
      export_channel: "atrio",
      export_status: "pending",
      export_type: "payment",
      payload: { payment_queue_id, empresa_id: resolvedEmpresaId, conta_id: resolvedContaId },
      attempts: 0,
      created_by: ctx.userId || "api",
    })
    .select()
    .single();

  if (insertErr) return errorResponse(500, "DB_ERROR", "Erro ao criar registro de exportação: " + insertErr.message, req, startMs);

  // 4. Obter token Atrio
  let token: string;
  let baseUrl: string;
  try {
    const auth = await getAtrioToken(supabase, resolvedEmpresaId);
    token = auth.token;
    baseUrl = auth.baseUrl;
  } catch (e: any) {
    await markExportError(supabase, exportRecord.id, e.message);
    return errorResponse(502, "ATRIO_AUTH_ERROR", e.message, req, startMs);
  }

  // 5. Upsert de fornecedor no Atrio — pular se já cadastrado (otimiza retry)
  let fornecedorId: number;
  if (cp?.atrio_fornecedor_id) {
    fornecedorId = Number(cp.atrio_fornecedor_id);
  } else {
    try {
      fornecedorId = await upsertFornecedorAtrio(baseUrl, token, item);
    } catch (e: any) {
      await markExportError(supabase, exportRecord.id, `Fornecedor: ${e.message}`);
      return errorResponse(502, "ATRIO_FORNECEDOR_ERROR", e.message, req, startMs);
    }
  }

  // 6. Lançamento — pular se atrio_numero já populado (idempotência pós-falha)
  let atrioNumero: number = cp?.atrio_numero;
  const atrioTipo = "9";
  const atrioSequencia = 1;

  if (!atrioNumero) {
    try {
      // Incremento atômico do número sequencial
      const { data: numData, error: numErr } = await supabase.rpc("increment_atrio_numero", { p_empresa_id: resolvedEmpresaId });
      if (numErr) throw new Error(numErr.message);
      atrioNumero = numData as number;

      // Buscar config de histórico/portador da empresa
      const { data: atrioConfig } = await supabase
        .from("atrio_empresa_config")
        .select("historico_id_default, portador_id_default")
        .eq("empresa_id", resolvedEmpresaId)
        .single();

      const historicoId = atrioConfig?.historico_id_default ?? 1;
      const portadorId  = atrioConfig?.portador_id_default  ?? 1;

      const lancamentoPayload = [{
        empresa:       resolvedEmpresaId,
        tipo:          atrioTipo,
        numero:        atrioNumero,
        sequencia:     atrioSequencia,
        fornecedorId,
        emissao:       cp?.data_emissao ?? new Date().toISOString().substring(0, 10),
        vencimento:    item.due_date ?? cp?.data_vencimento ?? new Date().toISOString().substring(0, 10),
        valor:         Number(item.amount) || Number(cp?.valor_aberto) || 0,
        historicoId,
        centroCustoId: historicoId,  // derivado do histórico conforme instrução de Daniel
        complemento:   observacao || item.description || "",
        portadorId,
        linhaEditavel: "",  // sempre vazio — campo obrigatório por design (confirmado Daniel)
        codBarras:     "",  // sempre vazio — idem
      }];

      const lancRes = await fetch(`${baseUrl}/contas-pagar/titulos`, {
        method: "POST",
        headers: atrioHeaders(token),
        body: JSON.stringify(lancamentoPayload),
      });

      if (!lancRes.ok) {
        const errBody = await lancRes.text().catch(() => "");
        throw new Error(`Lançamento HTTP ${lancRes.status}: ${errBody}`);
      }

      const lancJson = await lancRes.json();
      if (lancJson?.status !== "LANCADO") {
        throw new Error(`Lançamento retornou status inesperado: ${JSON.stringify(lancJson)}`);
      }

      // Persistir chave composta Atrio no título — garante idempotência para retry
      await supabase
        .from("contas_pagar")
        .update({
          atrio_tipo:         atrioTipo,
          atrio_numero:       atrioNumero,
          atrio_sequencia:    atrioSequencia,
          atrio_fornecedor_id: fornecedorId,
        })
        .eq("id", cp.id);

    } catch (e: any) {
      await markExportPartial(supabase, exportRecord.id, `Lançamento: ${e.message}`);
      return errorResponse(502, "ATRIO_LANCAMENTO_ERROR", e.message, req, startMs);
    }
  }

  // 7. Baixa
  try {
    if (!resolvedContaId) {
      throw new Error("conta_id obrigatório para baixa. Selecione a conta bancária de saída.");
    }

    const { data: atrioConfig } = await supabase
      .from("atrio_empresa_config")
      .select("portador_id_default")
      .eq("empresa_id", resolvedEmpresaId)
      .single();

    const portadorId = atrioConfig?.portador_id_default ?? 1;

    // usuario: email do JWT, max 30 chars (campo obrigatório na baixa)
    const usuario = (ctx.email || "sistema").substring(0, 30);

    const baixaPayload = {
      empresa:       resolvedEmpresaId,
      tipo:          atrioTipo,
      numero:        atrioNumero,
      sequencia:     atrioSequencia,
      valor:         Number(item.amount) || 0,
      dataPagamento: item.paid_at
        ? new Date(item.paid_at).toISOString().substring(0, 10)
        : new Date().toISOString().substring(0, 10),
      contaId:       resolvedContaId,
      formaPagamento: toAtrioFormaPagamento(item.payment_method),
      usuario,
      observacao,
      portadorId,
    };

    const baixaRes = await fetch(`${baseUrl}/contas-pagar/titulos/baixa`, {
      method: "POST",
      headers: atrioHeaders(token),
      body: JSON.stringify(baixaPayload),
    });

    if (!baixaRes.ok) {
      const errBody = await baixaRes.text().catch(() => "");
      throw new Error(`Baixa HTTP ${baixaRes.status}: ${errBody}`);
    }

    const baixaJson = await baixaRes.json();
    const statusBaixa: string = baixaJson?.status ?? "";
    if (statusBaixa !== "BAIXA_INTEGRAL" && statusBaixa !== "BAIXA_PARCIAL") {
      throw new Error(`Baixa retornou status inesperado: ${JSON.stringify(baixaJson)}`);
    }

    // Sucesso completo
    await supabase
      .from("erp_export_queue")
      .update({
        export_status:  "success",
        attempts:       1,
        last_attempt_at: new Date().toISOString(),
        exported_at:    new Date().toISOString(),
        response:       baixaJson,
      })
      .eq("id", exportRecord.id);

    return jsonResponse({
      success: true,
      export_id: exportRecord.id,
      atrio_numero: atrioNumero,
      status_baixa: statusBaixa,
      message: "Título lançado e baixado no ERP com sucesso",
    }, 200, req, { startMs });

  } catch (e: any) {
    // Lançamento OK mas baixa falhou → status "partial"
    // atrio_numero já salvo em contas_pagar → retry pode fazer apenas a baixa
    await markExportPartial(supabase, exportRecord.id, `Baixa: ${e.message}`);
    return errorResponse(502, "ATRIO_BAIXA_ERROR", e.message, req, startMs);
  }
}

// ── Upsert de fornecedor no Atrio ────────────────────────────────────────────

async function upsertFornecedorAtrio(baseUrl: string, token: string, item: any): Promise<number> {
  const cnpj = (item.supplier_document || "").replace(/\D/g, "");
  if (!cnpj) throw new Error("CNPJ do fornecedor ausente em financial_payment_queue.supplier_document");

  // BrasilAPI: dados completos do CNPJ (endereço, município, cep, etc.)
  // Fallback gracioso: se API estiver indisponível, usa dados mínimos do payment_queue.
  // POST /fornecedores no Atrio é idempotente — retorna ID existente se CNPJ já cadastrado.
  let brasil: Record<string, unknown> = {};
  try {
    const brasilRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (brasilRes.ok) brasil = await brasilRes.json();
  } catch { /* BrasilAPI indisponível — prosseguir com dados mínimos */ }

  // Código BGF: 7 dígitos sem o dígito verificador (8º dígito)
  // Usando os 7 primeiros do CNPJ como identificador único do fornecedor
  const codBgf = cnpj.substring(0, 7);

  const fornecedorPayload = {
    empresa:            1,          // sempre empresa 1 para fornecedores (instrução Daniel Vilanova)
    cnpj,
    razaoSocial:        brasil.razao_social || item.supplier_name || cnpj,
    nomeFantasia:       brasil.nome_fantasia || brasil.razao_social || item.supplier_name || "",
    endereco:           brasil.logradouro || "",
    numero:             brasil.numero || "S/N",
    complemento:        brasil.complemento || "",
    bairro:             brasil.bairro || "",
    cidade:             brasil.municipio || "",
    uf:                 brasil.uf || "",
    cep:                (brasil.cep || "").replace(/\D/g, ""),
    codIbge:            String(brasil.municipio_codigo_ibge || ""),
    telefone:           (brasil.ddd_telefone_1 || "").replace(/\D/g, ""),
    email:              "",
    codBgf,
    inscricaoEstadual:  "",
  };

  // POST /fornecedores tem comportamento upsert: retorna ID existente se CNPJ já cadastrado
  const res = await fetch(`${baseUrl}/fornecedores`, {
    method: "POST",
    headers: atrioHeaders(token),
    body: JSON.stringify(fornecedorPayload),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`POST /fornecedores HTTP ${res.status}: ${errBody}`);
  }

  const json = await res.json();
  const fornecedorId = json?.id ?? json?.fornecedorId;
  if (!fornecedorId) throw new Error(`POST /fornecedores não retornou ID: ${JSON.stringify(json)}`);
  return Number(fornecedorId);
}

// ── action: "retry" ──────────────────────────────────────────────────────────
// Mantido idêntico ao código anterior — retry de exportações antigas (n8n/rest_api)
// e retry de exportações Atrio com status "partial" (apenas baixa)

async function handleRetry(supabase: any, exportQueueId: string, req: Request, startMs: number) {
  const { data: record, error } = await supabase
    .from("erp_export_queue")
    .select("*")
    .eq("id", exportQueueId)
    .maybeSingle();

  if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
  if (!record) return errorResponse(404, "export_queue_not_found", `export_queue_id=${exportQueueId} não encontrado`, req, startMs);

  // Retry legado (n8n / rest_api)
  if (record.export_channel !== "atrio") {
    const result = await sendToLegacyChannel(record.export_channel, record.payload);
    const updateData: any = { attempts: (record.attempts || 0) + 1, last_attempt_at: new Date().toISOString() };
    if (result.success) { updateData.export_status = "success"; updateData.exported_at = new Date().toISOString(); updateData.error_message = null; }
    else                { updateData.export_status = "error"; updateData.error_message = result.error; }
    await supabase.from("erp_export_queue").update(updateData).eq("id", exportQueueId);
    return jsonResponse({ success: result.success, attempts: updateData.attempts, message: result.success ? "Reenvio bem-sucedido" : result.error }, 200, req, { startMs });
  }

  // Retry Atrio — apenas log de tentativa (requer payload completo via action:export)
  return errorResponse(400, "RETRY_USE_EXPORT", "Para retry de exportações Atrio use action='export' com o payment_queue_id original.", req, startMs);
}

// ── action: "status" ─────────────────────────────────────────────────────────

async function handleStatus(supabase: any, paymentQueueId: string, req: Request, startMs: number) {
  const { data } = await supabase
    .from("erp_export_queue")
    .select("*")
    .eq("payment_queue_id", paymentQueueId)
    .order("created_at", { ascending: false });

  return jsonResponse({
    exports:      data || [],
    registration: (data || []).find((e: any) => e.export_type === "registration") || null,
    payment:      (data || []).find((e: any) => e.export_type === "payment") || null,
  }, 200, req, { startMs });
}

// ── Helpers internos ─────────────────────────────────────────────────────────

async function markExportError(supabase: any, exportId: string, msg: string) {
  await supabase.from("erp_export_queue").update({
    export_status: "error", error_message: msg,
    attempts: 1, last_attempt_at: new Date().toISOString(),
  }).eq("id", exportId);
}

async function markExportPartial(supabase: any, exportId: string, msg: string) {
  await supabase.from("erp_export_queue").update({
    export_status: "partial", error_message: msg,
    attempts: 1, last_attempt_at: new Date().toISOString(),
  }).eq("id", exportId);
}

// Canal legado para retry de exportações antigas (n8n/rest_api)
async function sendToLegacyChannel(channel: string, payload: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (channel === "n8n") {
      const url = Deno.env.get("N8N_ERP_EXPORT_WEBHOOK_URL");
      if (!url) return { success: false, error: "N8N_ERP_EXPORT_WEBHOOK_URL não configurada." };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return res.ok ? { success: true } : { success: false, error: `N8N HTTP ${res.status}` };
    }
    if (channel === "rest_api") {
      const url = Deno.env.get("ERP_REST_API_URL");
      if (!url) return { success: false, error: "ERP_REST_API_URL não configurada." };
      const key = Deno.env.get("ERP_REST_API_KEY");
      const headers: any = { "Content-Type": "application/json" };
      if (key) headers["Authorization"] = `Bearer ${key}`;
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
      return res.ok ? { success: true } : { success: false, error: `REST API HTTP ${res.status}` };
    }
    return { success: false, error: `Canal legado desconhecido: ${channel}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
