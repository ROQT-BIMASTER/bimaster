import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

const PLUGGY_API_URL = "https://api.pluggy.ai";

async function getPluggyApiKey(): Promise<string> {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Pluggy credentials not configured");
  const res = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Pluggy auth failed (${res.status})`);
  const data = await res.json();
  return data.apiKey;
}

async function pluggyFetch(apiKey: string, path: string) {
  const res = await fetch(`${PLUGGY_API_URL}${path}`, {
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy API error (${res.status}): ${err}`);
  }
  return res.json();
}

async function syncTransactionsForItem(supabase: any, itemId: string, connectionId: string) {
  const apiKey = await getPluggyApiKey();
  const accountsData = await pluggyFetch(apiKey, `/items/${itemId}/accounts`);

  let allTransactions: any[] = [];
  for (const account of accountsData.results || []) {
    // Fetch last 30 days for incremental
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const params = new URLSearchParams({ pageSize: "500", from: thirtyDaysAgo });
    const txData = await pluggyFetch(apiKey, `/accounts/${account.id}/transactions?${params}`);
    allTransactions = allTransactions.concat(txData.results || []);
  }

  // Get contas_pagar for matching
  const { data: contasPagar } = await supabase
    .from("contas_pagar")
    .select("id, valor_original, valor_aberto, data_vencimento, fornecedor_nome, numero_documento, status")
    .in("status", ["Pendente", "Vencido", "Parcial"]);

  let conciliados = 0, pendentes = 0, divergentes = 0;
  const conciliacoes = [];

  for (const tx of allTransactions) {
    const txDate = tx.date?.split("T")[0];
    const txValue = Math.abs(tx.amount || 0);
    const txDesc = (tx.description || "").toUpperCase();
    const txDoc = tx.identifiers?.find((i: any) => i.type === "DOCUMENT")?.value || null;

    let matchedContaPagar = null;
    let confianca = null;

    if (contasPagar && txValue > 0) {
      if (txDoc) {
        matchedContaPagar = contasPagar.find((c: any) =>
          c.numero_documento && c.numero_documento === txDoc &&
          Math.abs(parseFloat(c.valor_aberto || c.valor_original) - txValue) < 0.01
        );
        if (matchedContaPagar) confianca = "alta";
      }
      if (!matchedContaPagar && txDate) {
        const txDateObj = new Date(txDate);
        matchedContaPagar = contasPagar.find((c: any) => {
          if (!c.data_vencimento) return false;
          const diffDays = Math.abs((txDateObj.getTime() - new Date(c.data_vencimento).getTime()) / 86400000);
          return diffDays <= 3 && Math.abs(parseFloat(c.valor_aberto || c.valor_original) - txValue) < 0.01;
        });
        if (matchedContaPagar) confianca = "media";
      }
      if (!matchedContaPagar) {
        matchedContaPagar = contasPagar.find((c: any) => {
          if (!c.fornecedor_nome) return false;
          const valorRef = parseFloat(c.valor_aberto || c.valor_original);
          return txDesc.includes(c.fornecedor_nome.toUpperCase()) && Math.abs(valorRef - txValue) / valorRef <= 0.05;
        });
        if (matchedContaPagar) confianca = "baixa";
      }
    }

    let statusConciliacao = "pendente";
    if (matchedContaPagar && confianca === "alta") {
      statusConciliacao = "conciliado";
      conciliados++;
      await supabase.from("contas_pagar").update({
        status: "Pago", valor_pago: txValue, data_pagamento: txDate,
      }).eq("id", matchedContaPagar.id);
      const idx = contasPagar.indexOf(matchedContaPagar);
      if (idx > -1) contasPagar.splice(idx, 1);
    } else if (matchedContaPagar) {
      pendentes++;
    } else {
      statusConciliacao = "divergente";
      divergentes++;
    }

    conciliacoes.push({
      bank_connection_id: connectionId,
      data_transacao: txDate,
      valor: tx.amount || 0,
      descricao: tx.description,
      tipo: (tx.amount || 0) < 0 ? "debito" : "credito",
      documento: txDoc,
      conta_pagar_id: matchedContaPagar?.id || null,
      status_conciliacao: statusConciliacao,
      confianca,
      pluggy_transaction_id: tx.id,
      pluggy_category: tx.category || null,
      pluggy_category_id: tx.categoryId || null,
      payment_data: tx.paymentData || null,
    });
  }

  if (conciliacoes.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < conciliacoes.length; i += batchSize) {
      await supabase.from("conciliacoes_bancarias").upsert(
        conciliacoes.slice(i, i + batchSize),
        { onConflict: "pluggy_transaction_id" }
      );
    }
  }

  // Update balance
  const totalBalance = (accountsData.results || []).reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
  await supabase.from("bank_connections").update({
    last_sync: new Date().toISOString(),
    saldo_atual: totalBalance,
    saldo_atualizado_em: new Date().toISOString(),
    status: "connected",
  }).eq("id", connectionId);

  // Check balance alerts
  const { data: alerts } = await supabase.from("balance_alerts").select("*").eq("bank_connection_id", connectionId).eq("is_active", true);
  if (alerts) {
    for (const alert of alerts) {
      if (totalBalance < alert.threshold) {
        await supabase.from("balance_alerts").update({ last_triggered_at: new Date().toISOString() }).eq("id", alert.id);
      }
    }
  }

  console.log(`✅ Auto-sync complete: ${allTransactions.length} tx, ${conciliados} conciliados, ${pendentes} pendentes, ${divergentes} divergentes`);
}

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 120,
  rateLimitPrefix: "pluggy-webhook",
  skipWaf: true,
}, async (req, _ctx) => {

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  let event: Record<string, unknown>;
  try {
    event = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const eventType = event.event as string | undefined;
  const itemId = event.itemId as string | undefined;

  if (!eventType || !itemId) {
    return new Response(JSON.stringify({ error: "Missing event or itemId" }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  console.log(`📩 Pluggy webhook: ${eventType} | itemId: ${itemId}`);

  const processAsync = async () => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find connection by itemId
    const { data: conn } = await supabase
      .from("bank_connections")
      .select("id")
      .eq("pluggy_item_id", itemId)
      .single();

    switch (eventType) {
      case "item/created": {
        console.log(`✅ item/created for ${itemId}`);
        break;
      }

      case "item/updated": {
        console.log(`🔄 item/updated for ${itemId} — triggering auto-sync`);
        await supabase.from("bank_connections").update({
          status: "connected",
          updated_at: new Date().toISOString(),
        }).eq("pluggy_item_id", itemId);

        // Auto-sync transactions
        if (conn) {
          try {
            await syncTransactionsForItem(supabase, itemId, conn.id);
          } catch (e) {
            console.error("❌ Auto-sync failed:", e);
          }
        }
        break;
      }

      case "transactions/created": {
        console.log(`📥 transactions/created for ${itemId} — incremental sync`);
        if (conn) {
          try {
            await syncTransactionsForItem(supabase, itemId, conn.id);
          } catch (e) {
            console.error("❌ Incremental sync failed:", e);
          }
        }
        break;
      }

      case "item/error": {
        const errorData = event.error;
        console.error(`❌ item/error for ${itemId}:`, errorData);
        await supabase.from("bank_connections").update({
          status: "error",
          updated_at: new Date().toISOString(),
        }).eq("pluggy_item_id", itemId);
        break;
      }

      case "connector/status_updated": {
        console.log(`🔌 connector/status_updated for ${itemId}`);
        // Just log — connector status changes are informational
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${eventType}`);
    }
  };

  processAsync().catch((err) => console.error("❌ Async processing error:", err));

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}));
