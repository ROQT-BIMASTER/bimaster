import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { z, validateBody, ValidationError } from "../_shared/validate.ts";

// === Zod Schemas ===
const ExportSchema = z.object({
  action: z.enum(["export", "retry", "status"]),
  payment_queue_id: z.string().uuid().optional(),
  export_queue_id: z.string().uuid().optional(),
  channel: z.enum(["n8n", "rest_api", "sql_direct"]).optional(),
  export_type: z.enum(["registration", "payment"]).optional(),
}).refine(d => {
  if (d.action === "export" && !d.payment_queue_id) return false;
  if (d.action === "retry" && !d.export_queue_id) return false;
  if (d.action === "status" && !d.payment_queue_id) return false;
  return true;
}, { message: "payment_queue_id ou export_queue_id obrigatório conforme action" });

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const requestId = crypto.randomUUID();

  try {
    if (req.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", `Método ${req.method} não suportado. Use POST.`, req, startMs);
    }

    const auth = await validateAnyAuth(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Safe JSON parse — corpo malformado vira 400, não 500
    let raw: unknown;
    try {
      raw = await req.json();
    } catch (_jsonErr) {
      return errorResponse(
        400,
        "INVALID_JSON",
        "Corpo da requisição não é JSON válido. Envie um objeto com 'action' (export|retry|status) e os campos obrigatórios.",
        req,
        startMs
      );
    }

    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return errorResponse(
        400,
        "INVALID_PAYLOAD",
        "Payload deve ser um objeto JSON. Esperado: { action, payment_queue_id|export_queue_id, ... }",
        req,
        startMs
      );
    }

    const body = validateBody(raw, ExportSchema);

    if (body.action === "export") {
      return await handleExport(supabase, body.payment_queue_id!, body.channel, auth.userId || "api", body.export_type, req, startMs);
    } else if (body.action === "retry") {
      return await handleRetry(supabase, body.export_queue_id!, req, startMs);
    } else if (body.action === "status") {
      return await handleStatus(supabase, body.payment_queue_id!, req, startMs);
    }

    return errorResponse(400, "INVALID_ACTION", "action deve ser 'export', 'retry' ou 'status'", req, startMs);
  } catch (err: unknown) {
    // ValidationError do Zod → 400 com detalhes
    if (err instanceof ValidationError) {
      const details = (err as ValidationError & { issues?: unknown }).issues;
      const headers = { "Content-Type": "application/json", "X-Request-ID": requestId };
      return new Response(
        JSON.stringify({
          error: "validation_error",
          message: err.message || "Payload inválido",
          details,
          request_id: requestId,
        }),
        { status: 400, headers }
      );
    }

    // Auth errors → respeita status (401/403)
    const e = err as { status?: number; message?: string; name?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }

    // Falha real de infra → 500 com request_id rastreável
    const message = (err instanceof Error && err.message) ? err.message : "Erro interno inesperado";
    console.error(`[erp-export-payment][${requestId}] internal error:`, err);
    const headers = { "Content-Type": "application/json", "X-Request-ID": requestId };
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message,
        request_id: requestId,
      }),
      { status: 500, headers }
    );
  }
});

function mapPaymentMethod(method: string | null): string {
  if (!method) return "Não informado";
  const map: Record<string, string> = {
    pix: "PIX", pix_code: "PIX", "2": "PIX",
    ted: "TED", transferencia: "Transferência Bancária", transfer: "Transferência Bancária",
    boleto: "Boleto", "1": "Boleto", cartao: "Cartão",
    credit_card: "Cartão de Crédito", debit_card: "Cartão de Débito",
    dinheiro: "Dinheiro", cash: "Dinheiro", cheque: "Cheque",
  };
  return map[method.toLowerCase().trim()] || method;
}

function cleanDocument(doc: string | null): string | null {
  if (!doc) return null;
  return doc.replace(/[^\d]/g, "");
}

function buildPayload(item: Record<string, unknown>, exportType: string) {
  const doc = item.supplier_document as string | null;
  const isRegistration = exportType === "registration";

  const payload: Record<string, unknown> = {
    api_version: "1.0",
    generated_at: new Date().toISOString(),
    id: item.id,
    empresa_id: item.empresa_id || 1,
    export_type: exportType,
    fornecedor: {
      nome: item.supplier_name,
      documento: cleanDocument(doc),
      documento_formatado: doc,
    },
    documento: {
      tipo: item.document_type,
      numero: item.document_number,
    },
    departamento: item.department_name,
    descricao: item.description,
  };

  if (isRegistration) {
    payload.pagamento = {
      valor: Number(item.amount) || 0,
      moeda: "BRL",
      data_vencimento: item.due_date,
      portador: item.portador,
    };
    payload.status = "Aguardando Pagamento";
  } else {
    payload.pagamento = {
      valor: Number(item.amount) || 0,
      moeda: "BRL",
      data_vencimento: item.due_date,
      data_pagamento: item.paid_at,
      metodo: mapPaymentMethod(item.payment_method as string),
      portador: item.portador,
    };
    payload.status = "Pago";
  }

  return payload;
}

async function handleExport(
  supabase: ReturnType<typeof createClient>,
  paymentQueueId: string,
  channel: string | undefined,
  userId: string,
  exportType: string | undefined,
  req: Request,
  startMs: number
) {
  const resolvedType = exportType || "payment";

  const { data: item, error: fetchErr } = await supabase
    .from("financial_payment_queue")
    .select("*")
    .eq("id", paymentQueueId)
    .maybeSingle();

  if (fetchErr) {
    return errorResponse(
      500,
      "DB_ERROR",
      `Erro ao buscar payment_queue: ${fetchErr.message}`,
      req,
      startMs
    );
  }
  if (!item) {
    // status: 404 — payment_queue_not_found
    return errorResponse(
      404,
      "payment_queue_not_found",
      `Nenhum registro encontrado em financial_payment_queue para payment_queue_id=${paymentQueueId}`,
      req,
      startMs
    );
  }

  const exportChannel = channel || "n8n";
  const payload = buildPayload(item, resolvedType);

  const { data: exportRecord, error: insertErr } = await supabase
    .from("erp_export_queue")
    .insert({
      payment_queue_id: paymentQueueId,
      export_channel: exportChannel,
      export_status: "pending",
      export_type: resolvedType,
      payload,
      attempts: 0,
      created_by: userId,
    })
    .select()
    .single();

  if (insertErr) {
    return errorResponse(500, "DB_ERROR", "Erro ao criar registro de exportação: " + insertErr.message, req, startMs);
  }

  const result = await sendToChannel(exportChannel, payload);

  const updateData: Record<string, unknown> = {
    attempts: 1,
    last_attempt_at: new Date().toISOString(),
  };

  if (result.success) {
    updateData.export_status = "success";
    updateData.response = result.response || {};
    updateData.exported_at = new Date().toISOString();
  } else {
    updateData.export_status = "error";
    updateData.error_message = result.error;
    updateData.response = result.response || null;
  }

  await supabase
    .from("erp_export_queue")
    .update(updateData)
    .eq("id", exportRecord.id);

  const typeLabel = resolvedType === "registration" ? "Provisão" : "Baixa";

  return jsonResponse({
    success: result.success,
    export_id: exportRecord.id,
    export_type: resolvedType,
    channel: exportChannel,
    message: result.success
      ? `${typeLabel} enviada ao ERP com sucesso`
      : result.error,
  }, result.success ? 200 : 502, req, { startMs });
}

async function handleRetry(supabase: ReturnType<typeof createClient>, exportQueueId: string, req: Request, startMs: number) {
  const { data: record, error } = await supabase
    .from("erp_export_queue")
    .select("*")
    .eq("id", exportQueueId)
    .single();

  if (error || !record) {
    return errorResponse(404, "NOT_FOUND", "Registro não encontrado", req, startMs);
  }

  const result = await sendToChannel(record.export_channel, record.payload);

  const updateData: Record<string, unknown> = {
    attempts: (record.attempts || 0) + 1,
    last_attempt_at: new Date().toISOString(),
  };

  if (result.success) {
    updateData.export_status = "success";
    updateData.response = result.response || {};
    updateData.exported_at = new Date().toISOString();
    updateData.error_message = null;
  } else {
    updateData.export_status = "error";
    updateData.error_message = result.error;
  }

  await supabase.from("erp_export_queue").update(updateData).eq("id", exportQueueId);

  return jsonResponse({
    success: result.success,
    attempts: updateData.attempts,
    message: result.success ? "Reenvio bem-sucedido" : result.error,
  }, 200, req, { startMs });
}

async function handleStatus(supabase: ReturnType<typeof createClient>, paymentQueueId: string, req: Request, startMs: number) {
  const { data } = await supabase
    .from("erp_export_queue")
    .select("*")
    .eq("payment_queue_id", paymentQueueId)
    .order("created_at", { ascending: false });

  return jsonResponse({
    exports: data || [],
    registration: (data || []).find((e: Record<string, unknown>) => e.export_type === "registration") || null,
    payment: (data || []).find((e: Record<string, unknown>) => e.export_type === "payment") || null,
  }, 200, req, { startMs });
}

async function sendToChannel(channel: string, payload: Record<string, unknown>): Promise<{ success: boolean; error?: string; response?: unknown }> {
  try {
    if (channel === "n8n") {
      const webhookUrl = Deno.env.get("N8N_ERP_EXPORT_WEBHOOK_URL");
      if (!webhookUrl) {
        return { success: false, error: "N8N_ERP_EXPORT_WEBHOOK_URL não configurada." };
      }
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      if (!res.ok) {
        return { success: false, error: `N8N respondeu com ${res.status}: ${body}`, response: body };
      }
      return { success: true, response: body };

    } else if (channel === "rest_api") {
      const apiUrl = Deno.env.get("ERP_REST_API_URL");
      const apiKey = Deno.env.get("ERP_REST_API_KEY");
      if (!apiUrl) {
        return { success: false, error: "ERP_REST_API_URL não configurada." };
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      
      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      if (!res.ok) {
        return { success: false, error: `ERP API respondeu com ${res.status}: ${body}`, response: body };
      }
      return { success: true, response: body };

    } else if (channel === "sql_direct") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient } = await import("npm:@supabase/supabase-js@2");
      const directClient = createClient(supabaseUrl, serviceKey);

      const empresaId = payload.empresa_id || 1;
      const exportType = payload.export_type;

      try {
        let query = directClient
          .from("contas_pagar")
          .select("*")
          .eq("empresa_id", empresaId);

        if (exportType === "registration") {
          query = query.in("status", ["pendente", "aguardando_pagamento"]);
        } else {
          query = query.eq("status", "pago");
        }

        const pagamento = payload.pagamento as Record<string, unknown> | undefined;
        if (pagamento?.data_vencimento) {
          query = query.eq("data_vencimento", pagamento.data_vencimento);
        }

        const { data: rows, error: queryError } = await query.limit(100);

        if (queryError) {
          return { success: false, error: `Erro na consulta SQL Direct: ${queryError.message}` };
        }

        return {
          success: true,
          response: {
            channel: "sql_direct",
            records_found: rows?.length || 0,
            data: rows || [],
            exported_at: new Date().toISOString(),
          },
        };
      } catch (sqlErr: unknown) {
        return { success: false, error: `Erro SQL Direct: ${(sqlErr as Error).message}` };
      }

    } else {
      return { success: false, error: `Canal desconhecido: ${channel}` };
    }
  } catch (err: unknown) {
    return { success: false, error: `Erro de rede: ${(err as Error).message}` };
  }
}
