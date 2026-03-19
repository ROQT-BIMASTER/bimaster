import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("EXPORT_API_KEY");

  if (!apiKey || apiKey !== expectedKey) {
    return jsonResponse({ error: "API key inválida ou ausente" }, 401);
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
    } else {
      if (req.method === "GET") {
        // Check if ?status includes cancelado
        const statusParam = url.searchParams.get("status");
        if (statusParam && statusParam.split(",").map(s => s.trim()).includes("cancelado")) {
          return await handleGetCancelledItems(supabase, url);
        }
        return await handleGetItems(supabase, url, null);
      }
      return jsonResponse({
        error: "Rota não encontrada. Rotas: GET /paid, GET /pending, GET /cancelled, POST /confirm, GET /status",
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

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
