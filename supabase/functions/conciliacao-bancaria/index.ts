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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy auth failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.apiKey;
}

async function pluggyFetch(apiKey: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${PLUGGY_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy API error (${res.status}): ${err}`);
  }
  return res.json();
}

// ─── Existing handlers ───

async function handleConnect(supabase: any, userId: string): Promise<Response> {
  const apiKey = await getPluggyApiKey();
  const data = await pluggyFetch(apiKey, "/connect_token", {
    method: "POST",
    body: JSON.stringify({ clientUserId: userId }),
  });
  return new Response(JSON.stringify({ accessToken: data.accessToken }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleSaveConnection(supabase: any, userId: string, body: any): Promise<Response> {
  const { itemId, banco, conta, agencia, empresaId } = body;
  const { data, error } = await supabase
    .from("bank_connections")
    .upsert(
      {
        user_id: userId,
        pluggy_item_id: itemId,
        banco: banco || "desconhecido",
        conta: conta || null,
        agencia: agencia || null,
        empresa_id: empresaId || null,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pluggy_item_id" }
    )
    .select()
    .single();
  if (error) throw error;

  // Auto-register webhook for this item
  try {
    const apiKey = await getPluggyApiKey();
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pluggy-webhook`;
    await pluggyFetch(apiKey, "/webhooks", {
      method: "POST",
      body: JSON.stringify({
        event: "item/updated",
        url: webhookUrl,
        headers: {},
      }),
    }).catch(() => { /* webhook may already exist */ });
    await pluggyFetch(apiKey, "/webhooks", {
      method: "POST",
      body: JSON.stringify({
        event: "transactions/created",
        url: webhookUrl,
        headers: {},
      }),
    }).catch(() => { /* webhook may already exist */ });
  } catch (e) {
    console.warn("⚠️ Could not register webhooks:", e);
  }

  return new Response(JSON.stringify({ connection: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleSyncTransactions(supabase: any, userId: string, body: any): Promise<Response> {
  const { connectionId, dateFrom, dateTo } = body;
  const startTime = Date.now();

  const { data: conn, error: connErr } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("id", connectionId)
    .single();
  if (connErr || !conn) throw new Error("Connection not found");

  const { data: upload } = await supabase
    .from("conciliacao_uploads")
    .insert({ bank_connection_id: connectionId, user_id: userId, status: "processing" })
    .select()
    .single();

  const apiKey = await getPluggyApiKey();
  const accountsData = await pluggyFetch(apiKey, `/items/${conn.pluggy_item_id}/accounts`);

  let allTransactions: any[] = [];
  for (const account of accountsData.results || []) {
    // Update account type info on bank_connections
    if (account.type === "CREDIT" || account.subtype === "CREDIT_CARD") {
      await supabase.from("bank_connections").update({
        account_type: "CREDIT_CARD",
        credit_limit: account.creditData?.creditLimit || null,
        available_limit: account.creditData?.availableCreditLimit || null,
        bill_due_date: account.creditData?.billDueDate || null,
        bill_amount: account.creditData?.billTotalAmount || null,
      }).eq("id", connectionId);
    }

    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const params = new URLSearchParams({ page: String(page), pageSize: "500" });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const txData = await pluggyFetch(apiKey, `/accounts/${account.id}/transactions?${params}`);
      allTransactions = allTransactions.concat(txData.results || []);
      hasMore = (txData.results?.length || 0) === 500;
      page++;
    }
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
      // Tier 1: documento + valor exato
      if (txDoc) {
        matchedContaPagar = contasPagar.find(
          (c: any) => c.numero_documento && c.numero_documento === txDoc &&
            Math.abs(parseFloat(c.valor_aberto || c.valor_original) - txValue) < 0.01
        );
        if (matchedContaPagar) confianca = "alta";
      }
      // Tier 2: valor + data ±3 dias
      if (!matchedContaPagar && txDate) {
        const txDateObj = new Date(txDate);
        matchedContaPagar = contasPagar.find((c: any) => {
          if (!c.data_vencimento) return false;
          const vencDate = new Date(c.data_vencimento);
          const diffDays = Math.abs((txDateObj.getTime() - vencDate.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 3 && Math.abs(parseFloat(c.valor_aberto || c.valor_original) - txValue) < 0.01;
        });
        if (matchedContaPagar) confianca = "media";
      }
      // Tier 3: fornecedor + valor ±5%
      if (!matchedContaPagar) {
        matchedContaPagar = contasPagar.find((c: any) => {
          if (!c.fornecedor_nome) return false;
          const fornecedorUpper = c.fornecedor_nome.toUpperCase();
          const valorRef = parseFloat(c.valor_aberto || c.valor_original);
          const diff = Math.abs(valorRef - txValue) / valorRef;
          return txDesc.includes(fornecedorUpper) && diff <= 0.05;
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
      statusConciliacao = "pendente";
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

  // Batch insert
  if (conciliacoes.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < conciliacoes.length; i += batchSize) {
      await supabase.from("conciliacoes_bancarias").upsert(
        conciliacoes.slice(i, i + batchSize),
        { onConflict: "pluggy_transaction_id" }
      );
    }
  }

  // Auto-map categories to chart of accounts
  await autoMapCategories(supabase, conciliacoes);

  const duracao = Date.now() - startTime;
  await supabase.from("conciliacao_uploads").update({
    total_transacoes: allTransactions.length, conciliados, pendentes, divergentes, duracao_ms: duracao, status: "completed",
  }).eq("id", upload.id);

  const totalBalance = (accountsData.results || []).reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
  await supabase.from("bank_connections").update({
    last_sync: new Date().toISOString(),
    saldo_atual: totalBalance,
    saldo_atualizado_em: new Date().toISOString(),
  }).eq("id", connectionId);

  // Check balance alerts
  await checkBalanceAlerts(supabase, connectionId, totalBalance);

  return new Response(
    JSON.stringify({ total: allTransactions.length, conciliados, pendentes, divergentes, duracao_ms: duracao }),
    { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
}

async function autoMapCategories(supabase: any, conciliacoes: any[]) {
  // Get user's category rules
  const categoryIds = [...new Set(conciliacoes.filter(c => c.pluggy_category_id).map(c => c.pluggy_category_id))];
  if (categoryIds.length === 0) return;

  const { data: rules } = await supabase
    .from("pluggy_category_rules")
    .select("category_id, conta_contabil_id")
    .in("category_id", categoryIds)
    .not("conta_contabil_id", "is", null);

  if (!rules || rules.length === 0) return;

  const ruleMap = new Map(rules.map((r: any) => [r.category_id, r.conta_contabil_id]));

  for (const c of conciliacoes) {
    if (c.pluggy_category_id && ruleMap.has(c.pluggy_category_id)) {
      await supabase.from("conciliacoes_bancarias")
        .update({ conta_contabil_id: ruleMap.get(c.pluggy_category_id) })
        .eq("pluggy_transaction_id", c.pluggy_transaction_id);
    }
  }
}

async function checkBalanceAlerts(supabase: any, connectionId: string, balance: number) {
  const { data: alerts } = await supabase
    .from("balance_alerts")
    .select("*")
    .eq("bank_connection_id", connectionId)
    .eq("is_active", true);

  if (!alerts) return;

  for (const alert of alerts) {
    if (balance < alert.threshold) {
      // Update last triggered
      await supabase.from("balance_alerts")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", alert.id);
      console.log(`⚠️ Balance alert triggered: ${balance} < ${alert.threshold} for connection ${connectionId}`);
    }
  }
}

async function handleMatchManual(supabase: any, body: any): Promise<Response> {
  const { conciliacaoId, contaPagarId } = body;
  const { data: conc, error: concErr } = await supabase.from("conciliacoes_bancarias").select("*").eq("id", conciliacaoId).single();
  if (concErr) throw concErr;

  await supabase.from("conciliacoes_bancarias").update({
    conta_pagar_id: contaPagarId, status_conciliacao: "conciliado", confianca: "manual",
  }).eq("id", conciliacaoId);

  await supabase.from("contas_pagar").update({
    status: "Pago", valor_pago: Math.abs(conc.valor), data_pagamento: conc.data_transacao,
  }).eq("id", contaPagarId);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleHistory(supabase: any): Promise<Response> {
  const { data, error } = await supabase
    .from("conciliacao_uploads")
    .select("*, bank_connections(banco, conta, agencia)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return new Response(JSON.stringify({ uploads: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleListConnections(supabase: any, userId: string, body: any): Promise<Response> {
  let query = supabase
    .from("bank_connections")
    .select("*, empresas(id, nome, cnpj, uf)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (body?.empresaId) query = query.eq("empresa_id", body.empresaId);
  const { data, error } = await query;
  if (error) throw error;
  return new Response(JSON.stringify({ connections: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── NEW: Pluggy Connectors ───

async function handleListConnectors(_supabase: any, body: any): Promise<Response> {
  const apiKey = await getPluggyApiKey();
  const params = new URLSearchParams();
  if (body?.name) params.set("name", body.name);
  if (body?.countries) params.set("countries", body.countries);
  if (body?.types) params.set("types", body.types);
  params.set("pageSize", "100");

  const data = await pluggyFetch(apiKey, `/connectors?${params}`);
  return new Response(JSON.stringify({ connectors: data.results || [] }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── NEW: Identity ───

async function handleFetchIdentity(supabase: any, body: any): Promise<Response> {
  const { connectionId } = body;
  const { data: conn } = await supabase.from("bank_connections").select("pluggy_item_id").eq("id", connectionId).single();
  if (!conn) throw new Error("Connection not found");

  const apiKey = await getPluggyApiKey();
  const data = await pluggyFetch(apiKey, `/identity?itemId=${conn.pluggy_item_id}`);

  const identity = data.results?.[0];
  if (identity) {
    await supabase.from("pluggy_identities").upsert({
      bank_connection_id: connectionId,
      full_name: identity.fullName || identity.companyName || null,
      document: identity.document || null,
      document_type: identity.documentType || null,
      tax_number: identity.taxNumber || null,
      birth_date: identity.birthDate || null,
      addresses: identity.addresses || [],
      emails: identity.emails || [],
      phones: identity.phoneNumbers || [],
      raw_data: identity,
      last_sync: new Date().toISOString(),
    }, { onConflict: "bank_connection_id" });
  }

  return new Response(JSON.stringify({ identity }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── NEW: Investments ───

async function handleFetchInvestments(supabase: any, body: any): Promise<Response> {
  const { connectionId } = body;
  const { data: conn } = await supabase.from("bank_connections").select("pluggy_item_id").eq("id", connectionId).single();
  if (!conn) throw new Error("Connection not found");

  const apiKey = await getPluggyApiKey();
  const data = await pluggyFetch(apiKey, `/investments?itemId=${conn.pluggy_item_id}`);

  const investments = data.results || [];

  for (const inv of investments) {
    await supabase.from("pluggy_investments").upsert({
      bank_connection_id: connectionId,
      pluggy_investment_id: inv.id,
      name: inv.name || null,
      type: inv.type || null,
      subtype: inv.subtype || null,
      balance: inv.balance || 0,
      currency_code: inv.currencyCode || "BRL",
      annual_rate: inv.annualRate || null,
      status: inv.status || null,
      due_date: inv.dueDate || null,
      issuer: inv.issuer || null,
      issue_date: inv.issueDate || null,
      metadata: inv,
      last_sync: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "pluggy_investment_id" });
  }

  return new Response(JSON.stringify({ investments, total: investments.length }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleFetchInvestmentDetail(supabase: any, body: any): Promise<Response> {
  const { investmentId } = body;
  const apiKey = await getPluggyApiKey();
  const data = await pluggyFetch(apiKey, `/investments/${investmentId}`);
  return new Response(JSON.stringify({ investment: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleFetchInvestmentTransactions(supabase: any, body: any): Promise<Response> {
  const { investmentId, dateFrom, dateTo } = body;
  const apiKey = await getPluggyApiKey();

  const params = new URLSearchParams({ pageSize: "500" });
  if (dateFrom) params.set("from", dateFrom);
  if (dateTo) params.set("to", dateTo);

  const data = await pluggyFetch(apiKey, `/investments/${investmentId}/transactions?${params}`);

  const transactions = data.results || [];
  // Save to DB
  for (const tx of transactions) {
    const { data: inv } = await supabase
      .from("pluggy_investments")
      .select("id")
      .eq("pluggy_investment_id", investmentId)
      .single();

    if (inv) {
      await supabase.from("pluggy_investment_transactions").upsert({
        investment_id: inv.id,
        pluggy_transaction_id: tx.id,
        type: tx.type || null,
        description: tx.description || null,
        amount: tx.amount || null,
        quantity: tx.quantity || null,
        value: tx.value || null,
        date: tx.date?.split("T")[0] || null,
      }, { onConflict: "pluggy_transaction_id" });
    }
  }

  return new Response(JSON.stringify({ transactions, total: transactions.length }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── NEW: Accounts (includes CREDIT_CARD, LOAN) ───

async function handleFetchAccounts(supabase: any, body: any): Promise<Response> {
  const { connectionId } = body;
  const { data: conn } = await supabase.from("bank_connections").select("pluggy_item_id").eq("id", connectionId).single();
  if (!conn) throw new Error("Connection not found");

  const apiKey = await getPluggyApiKey();
  const data = await pluggyFetch(apiKey, `/items/${conn.pluggy_item_id}/accounts`);

  const accounts = data.results || [];

  // Process loan accounts
  for (const acc of accounts) {
    if (acc.type === "LOAN" || acc.subtype === "LOAN") {
      await supabase.from("pluggy_loans").upsert({
        bank_connection_id: connectionId,
        pluggy_account_id: acc.id,
        name: acc.name || acc.subtype || "Empréstimo",
        loan_amount: acc.loanData?.principal || null,
        outstanding_balance: acc.balance || null,
        interest_rate: acc.loanData?.interestRate || null,
        installments_total: acc.loanData?.installments || null,
        installments_paid: acc.loanData?.installmentsPaid || null,
        next_payment_date: acc.loanData?.nextPaymentDate || null,
        monthly_payment: acc.loanData?.monthlyPayment || null,
        contract_number: acc.loanData?.contractNumber || null,
        metadata: acc,
        last_sync: new Date().toISOString(),
      }, { onConflict: "pluggy_account_id" }).catch(() => {
        // If no unique constraint, just insert
        supabase.from("pluggy_loans").insert({
          bank_connection_id: connectionId,
          pluggy_account_id: acc.id,
          name: acc.name || "Empréstimo",
          outstanding_balance: acc.balance || null,
          metadata: acc,
          last_sync: new Date().toISOString(),
        });
      });
    }

    // Update credit card info
    if (acc.type === "CREDIT" || acc.subtype === "CREDIT_CARD") {
      await supabase.from("bank_connections").update({
        account_type: "CREDIT_CARD",
        credit_limit: acc.creditData?.creditLimit || null,
        available_limit: acc.creditData?.availableCreditLimit || null,
        bill_due_date: acc.creditData?.billDueDate || null,
        bill_amount: acc.creditData?.billTotalAmount || null,
      }).eq("id", connectionId);
    }
  }

  return new Response(JSON.stringify({ accounts }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── NEW: Categories ───

async function handleFetchCategories(): Promise<Response> {
  const apiKey = await getPluggyApiKey();
  const data = await pluggyFetch(apiKey, "/categories");
  return new Response(JSON.stringify({ categories: data.results || data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleCreateCategoryRule(supabase: any, userId: string, body: any): Promise<Response> {
  const { description, categoryId, categoryName, contaContabilId } = body;
  const apiKey = await getPluggyApiKey();

  // Create rule in Pluggy
  let pluggyRuleId = null;
  try {
    const result = await pluggyFetch(apiKey, "/categories/rules", {
      method: "POST",
      body: JSON.stringify({ description, categoryId }),
    });
    pluggyRuleId = result.id;
  } catch (e) {
    console.warn("⚠️ Could not create Pluggy rule:", e);
  }

  // Save locally
  const { data, error } = await supabase.from("pluggy_category_rules").insert({
    user_id: userId,
    pluggy_rule_id: pluggyRuleId,
    description,
    category_id: categoryId,
    category_name: categoryName || null,
    conta_contabil_id: contaContabilId || null,
  }).select().single();

  if (error) throw error;

  return new Response(JSON.stringify({ rule: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleListCategoryRules(supabase: any, userId: string): Promise<Response> {
  const { data, error } = await supabase
    .from("pluggy_category_rules")
    .select("*, trade_chart_of_accounts(codigo, descricao)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return new Response(JSON.stringify({ rules: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleDeleteCategoryRule(supabase: any, userId: string, body: any): Promise<Response> {
  const { ruleId } = body;

  // Get rule to delete from Pluggy
  const { data: rule } = await supabase.from("pluggy_category_rules").select("pluggy_rule_id").eq("id", ruleId).eq("user_id", userId).single();

  if (rule?.pluggy_rule_id) {
    try {
      const apiKey = await getPluggyApiKey();
      await fetch(`${PLUGGY_API_URL}/categories/rules/${rule.pluggy_rule_id}`, {
        method: "DELETE",
        headers: { "X-API-KEY": apiKey },
      });
    } catch (e) {
      console.warn("⚠️ Could not delete Pluggy rule:", e);
    }
  }

  await supabase.from("pluggy_category_rules").delete().eq("id", ruleId).eq("user_id", userId);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── NEW: Balance Alerts ───

async function handleManageBalanceAlert(supabase: any, userId: string, body: any): Promise<Response> {
  const { connectionId, threshold, alertId, action: alertAction } = body;

  if (alertAction === "delete" && alertId) {
    await supabase.from("balance_alerts").delete().eq("id", alertId).eq("user_id", userId);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  if (alertAction === "toggle" && alertId) {
    const { data: existing } = await supabase.from("balance_alerts").select("is_active").eq("id", alertId).single();
    await supabase.from("balance_alerts").update({ is_active: !existing?.is_active }).eq("id", alertId);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Create new alert
  const { data, error } = await supabase.from("balance_alerts").insert({
    bank_connection_id: connectionId,
    user_id: userId,
    threshold,
  }).select().single();
  if (error) throw error;

  return new Response(JSON.stringify({ alert: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function handleListBalanceAlerts(supabase: any, userId: string): Promise<Response> {
  const { data, error } = await supabase
    .from("balance_alerts")
    .select("*, bank_connections(banco, conta, empresa_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return new Response(JSON.stringify({ alerts: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── NEW: Register Webhook ───

async function handleRegisterWebhook(body: any): Promise<Response> {
  const apiKey = await getPluggyApiKey();
  const webhookUrl = body.url || `${Deno.env.get("SUPABASE_URL")}/functions/v1/pluggy-webhook`;
  const event = body.event || "item/updated";

  const data = await pluggyFetch(apiKey, "/webhooks", {
    method: "POST",
    body: JSON.stringify({ event, url: webhookUrl, headers: {} }),
  });

  return new Response(JSON.stringify({ webhook: data }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── Router ───

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 30,
  rateLimitPrefix: "conciliacao-bancaria",
}, async (req, _ctx) => {

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json() : {};
    const action = body.action || new URL(req.url).searchParams.get("action");

    switch (action) {
      case "connect":
        return await handleConnect(supabase, user.id);
      case "save-connection":
        return await handleSaveConnection(supabase, user.id, body);
      case "sync-transactions":
        return await handleSyncTransactions(supabase, user.id, body);
      case "match-manual":
        return await handleMatchManual(supabase, body);
      case "history":
        return await handleHistory(supabase);
      case "list-connections":
        return await handleListConnections(supabase, user.id, body);
      // New actions
      case "list-connectors":
        return await handleListConnectors(supabase, body);
      case "fetch-identity":
        return await handleFetchIdentity(supabase, body);
      case "fetch-investments":
        return await handleFetchInvestments(supabase, body);
      case "fetch-investment-detail":
        return await handleFetchInvestmentDetail(supabase, body);
      case "fetch-investment-transactions":
        return await handleFetchInvestmentTransactions(supabase, body);
      case "fetch-accounts":
        return await handleFetchAccounts(supabase, body);
      case "fetch-categories":
        return await handleFetchCategories();
      case "create-category-rule":
        return await handleCreateCategoryRule(supabase, user.id, body);
      case "list-category-rules":
        return await handleListCategoryRules(supabase, user.id);
      case "delete-category-rule":
        return await handleDeleteCategoryRule(supabase, user.id, body);
      case "manage-balance-alert":
        return await handleManageBalanceAlert(supabase, user.id, body);
      case "list-balance-alerts":
        return await handleListBalanceAlerts(supabase, user.id);
      case "register-webhook":
        return await handleRegisterWebhook(body);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    console.error("conciliacao-bancaria error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
}));
