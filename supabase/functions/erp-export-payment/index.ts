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

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Token inválido" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, payment_queue_id, export_queue_id, channel } = body;

    if (action === "export") {
      return await handleExport(supabase, payment_queue_id, channel, user.id);
    } else if (action === "retry") {
      return await handleRetry(supabase, export_queue_id, user.id);
    } else if (action === "status") {
      return await handleStatus(supabase, payment_queue_id);
    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("erp-export-payment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

async function handleExport(supabase: any, paymentQueueId: string, channel: string | undefined, userId: string) {
  const { data: item, error: fetchErr } = await supabase
    .from("financial_payment_queue")
    .select("*")
    .eq("id", paymentQueueId)
    .single();

  if (fetchErr || !item) {
    return jsonResponse({ error: "Item não encontrado" }, 404);
  }

  const exportChannel = channel || "n8n";

  const doc = item.supplier_document as string | null;
  const cleanDoc = doc ? doc.replace(/[^\d]/g, "") : null;

  const payload = {
    api_version: "1.0",
    generated_at: new Date().toISOString(),
    id: paymentQueueId,
    empresa_id: item.empresa_id || 1,
    fornecedor: {
      nome: item.supplier_name,
      documento: cleanDoc,
      documento_formatado: doc,
    },
    documento: {
      tipo: item.document_type,
      numero: item.document_number,
    },
    pagamento: {
      valor: Number(item.amount) || 0,
      moeda: "BRL",
      data_vencimento: item.due_date,
      data_pagamento: item.paid_at,
      metodo: mapPaymentMethod(item.payment_method),
      portador: item.portador,
    },
    departamento: item.department_name,
    descricao: item.description,
    status: "Pago",
  };

  // Create export queue record
  const { data: exportRecord, error: insertErr } = await supabase
    .from("erp_export_queue")
    .insert({
      payment_queue_id: paymentQueueId,
      export_channel: exportChannel,
      export_status: "pending",
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

  return jsonResponse({
    success: result.success,
    export_id: exportRecord.id,
    channel: exportChannel,
    message: result.success ? "Enviado ao ERP com sucesso" : result.error,
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
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return jsonResponse({ export: data || null });
}

async function sendToChannel(channel: string, payload: Record<string, unknown>): Promise<{ success: boolean; error?: string; response?: unknown }> {
  try {
    if (channel === "n8n") {
      const webhookUrl = Deno.env.get("N8N_ERP_EXPORT_WEBHOOK_URL");
      if (!webhookUrl) {
        return { success: false, error: "N8N_ERP_EXPORT_WEBHOOK_URL não configurada. Configure nas variáveis de ambiente." };
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
        return { success: false, error: "ERP_REST_API_URL não configurada. Configure nas variáveis de ambiente." };
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
      // SQL Server direct connection would require a library like node-mssql
      // For now, return a placeholder indicating the channel needs configuration
      const sqlHost = Deno.env.get("ERP_SQL_HOST");
      if (!sqlHost) {
        return { success: false, error: "ERP_SQL_HOST não configurado. Configure as credenciais SQL Server nas variáveis de ambiente." };
      }
      // In production, this would use mssql to INSERT into the ERP database
      // For now, log and return success placeholder
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
