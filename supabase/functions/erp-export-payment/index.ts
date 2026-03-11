import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Token inválido" }, 401);
  }

  try {
    const body = await req.json();
    const { action, payment_queue_id, export_queue_id, channel, export_type } = body;

    if (action === "export") {
      return await handleExport(supabase, payment_queue_id, channel, user.id, export_type);
    } else if (action === "retry") {
      return await handleRetry(supabase, export_queue_id, user.id);
    } else if (action === "status") {
      return await handleStatus(supabase, payment_queue_id);
    } else {
      return jsonResponse({ error: "Ação inválida" }, 400);
    }
  } catch (err) {
    console.error("erp-export-payment error:", err);
    return jsonResponse({ error: err.message }, 500);
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

/**
 * Build payload based on export_type:
 * - registration: provisão (Aguardando Pagamento), sem dados de pagamento
 * - payment: baixa (Pago), com dados completos de pagamento
 */
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
    // Provisão: apenas dados do título, sem pagamento
    payload.pagamento = {
      valor: Number(item.amount) || 0,
      moeda: "BRL",
      data_vencimento: item.due_date,
      portador: item.portador,
    };
    payload.status = "Aguardando Pagamento";
  } else {
    // Baixa: dados completos com método e data de pagamento
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
  supabase: any,
  paymentQueueId: string,
  channel: string | undefined,
  userId: string,
  exportType: string | undefined
) {
  const resolvedType = exportType || "payment";

  const { data: item, error: fetchErr } = await supabase
    .from("financial_payment_queue")
    .select("*")
    .eq("id", paymentQueueId)
    .single();

  if (fetchErr || !item) {
    return jsonResponse({ error: "Item não encontrado" }, 404);
  }

  const exportChannel = channel || "n8n";
  const payload = buildPayload(item, resolvedType);

  // Create export queue record
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
    return jsonResponse({ error: "Erro ao criar registro de exportação: " + insertErr.message }, 500);
  }

  // Attempt to send via the selected channel
  const result = await sendToChannel(exportChannel, payload);

  // Update export record with result
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
  });
}

async function handleRetry(supabase: any, exportQueueId: string, userId: string) {
  const { data: record, error } = await supabase
    .from("erp_export_queue")
    .select("*")
    .eq("id", exportQueueId)
    .single();

  if (error || !record) {
    return jsonResponse({ error: "Registro não encontrado" }, 404);
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
  });
}

async function handleStatus(supabase: any, paymentQueueId: string) {
  const { data, error } = await supabase
    .from("erp_export_queue")
    .select("*")
    .eq("payment_queue_id", paymentQueueId)
    .order("created_at", { ascending: false });

  // Return both registration and payment exports
  return jsonResponse({
    exports: data || [],
    registration: (data || []).find((e: any) => e.export_type === "registration") || null,
    payment: (data || []).find((e: any) => e.export_type === "payment") || null,
  });
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
      const sqlHost = Deno.env.get("ERP_SQL_HOST");
      if (!sqlHost) {
        return { success: false, error: "ERP_SQL_HOST não configurado." };
      }
      console.log("SQL Direct payload:", JSON.stringify(payload));
      return { success: false, error: "Canal SQL Direct ainda não implementado. Use N8N ou REST API." };

    } else {
      return { success: false, error: `Canal desconhecido: ${channel}` };
    }
  } catch (err) {
    return { success: false, error: `Erro de rede: ${err.message}` };
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
