import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Map internal payment method codes to readable names
function mapPaymentMethod(method: string | null): string {
  if (!method) return "Não informado";
  const map: Record<string, string> = {
    pix: "PIX",
    pix_code: "PIX",
    "2": "PIX",
    ted: "TED",
    transferencia: "Transferência Bancária",
    transfer: "Transferência Bancária",
    boleto: "Boleto",
    "1": "Boleto",
    cartao: "Cartão",
    credit_card: "Cartão de Crédito",
    debit_card: "Cartão de Débito",
    dinheiro: "Dinheiro",
    cash: "Dinheiro",
    cheque: "Cheque",
  };
  const key = method.toLowerCase().trim();
  return map[key] || method;
}

// Build clean payload without internal codes
function buildCleanPayload(item: Record<string, unknown>) {
  return {
    id: item.id,
    empresa_id: item.empresa_id || 1,
    fornecedor_nome: item.supplier_name || null,
    fornecedor_documento: item.supplier_document || null,
    tipo_documento: item.document_type || null,
    numero_documento: item.document_number || null,
    valor: item.amount || 0,
    data_vencimento: item.due_date || null,
    data_pagamento: item.paid_at || null,
    metodo_pagamento: mapPaymentMethod(item.payment_method as string),
    portador: item.portador || null,
    departamento: item.department_name || null,
    descricao: item.description || null,
    status: "Pago",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Authenticate via x-api-key header
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("EXPORT_API_KEY");

  if (!apiKey || apiKey !== expectedKey) {
    return jsonResponse({ error: "API key inválida ou ausente" }, 401);
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "GET" && path === "paid") {
      return await handleGetPaid(supabase, url);
    } else if (req.method === "POST" && path === "confirm") {
      return await handleConfirm(supabase, req);
    } else if (req.method === "GET" && path === "status") {
      return await handleStatus(supabase);
    } else {
      // Default: treat as /paid for simple GET requests
      if (req.method === "GET") {
        return await handleGetPaid(supabase, url);
      }
      return jsonResponse({ error: "Rota não encontrada. Rotas disponíveis: GET /paid, POST /confirm, GET /status" }, 404);
    }
  } catch (err) {
    console.error("contas-pagar-export-api error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

async function handleGetPaid(supabase: ReturnType<typeof createClient>, url: URL) {
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Get paid items from financial_payment_queue that are pending export
  // Left join with erp_export_queue to find items not yet exported
  const { data: paidItems, error: paidErr } = await supabase
    .from("financial_payment_queue")
    .select("*")
    .eq("financial_status", "paid")
    .order("paid_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (paidErr) {
    return jsonResponse({ error: "Erro ao buscar pagamentos: " + paidErr.message }, 500);
  }

  if (!paidItems || paidItems.length === 0) {
    return jsonResponse({ data: [], total: 0, message: "Nenhum pagamento pago encontrado" });
  }

  // Check which ones have already been exported (confirmed)
  const ids = paidItems.map((i: Record<string, unknown>) => i.id);
  const { data: exportedItems } = await supabase
    .from("erp_export_queue")
    .select("payment_queue_id, export_status")
    .in("payment_queue_id", ids)
    .eq("export_status", "exported");

  const exportedSet = new Set(
    (exportedItems || []).map((e: Record<string, unknown>) => e.payment_queue_id)
  );

  // Filter out already exported items
  const pendingItems = paidItems.filter(
    (item: Record<string, unknown>) => !exportedSet.has(item.id)
  );

  // Build clean payload
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
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return jsonResponse({ error: "Envie um array 'ids' com os IDs dos pagamentos confirmados" }, 400);
  }

  let confirmed = 0;
  const errors: string[] = [];

  for (const paymentId of ids) {
    // Check if export record exists
    const { data: existing } = await supabase
      .from("erp_export_queue")
      .select("id")
      .eq("payment_queue_id", paymentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Update existing record
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
      // Create export record and mark as exported
      const { error: insertErr } = await supabase
        .from("erp_export_queue")
        .insert({
          payment_queue_id: paymentId,
          export_channel: "pull_api",
          export_status: "exported",
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
    errors: errors.length > 0 ? errors : undefined,
    message: `${confirmed} pagamento(s) confirmado(s) como exportado(s)`,
  });
}

async function handleStatus(supabase: ReturnType<typeof createClient>) {
  // Total paid
  const { count: totalPaid } = await supabase
    .from("financial_payment_queue")
    .select("id", { count: "exact", head: true })
    .eq("financial_status", "paid");

  // Total exported
  const { count: totalExported } = await supabase
    .from("erp_export_queue")
    .select("id", { count: "exact", head: true })
    .eq("export_status", "exported");

  // Total pending (paid - exported)
  const pending = (totalPaid || 0) - (totalExported || 0);

  return jsonResponse({
    total_pagos: totalPaid || 0,
    total_exportados: totalExported || 0,
    pendentes_exportacao: pending > 0 ? pending : 0,
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
