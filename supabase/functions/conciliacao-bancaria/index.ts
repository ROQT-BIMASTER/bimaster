import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLUGGY_API_URL = "https://api.pluggy.ai";

async function getPluggyApiKey(): Promise<string> {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  console.log("🔑 Pluggy auth: clientId exists?", !!clientId, "clientSecret exists?", !!clientSecret);
  if (!clientId || !clientSecret) throw new Error("Pluggy credentials not configured");

  console.log("📡 Calling Pluggy /auth...");
  const res = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  console.log("📡 Pluggy /auth response status:", res.status);
  if (!res.ok) {
    const err = await res.text();
    console.error("❌ Pluggy auth error:", err);
    throw new Error(`Pluggy auth failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  console.log("✅ Pluggy apiKey obtained, length:", data.apiKey?.length);
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

async function handleConnect(supabase: any, userId: string): Promise<Response> {
  console.log("🔌 handleConnect called for userId:", userId);
  const apiKey = await getPluggyApiKey();
  console.log("📡 Calling Pluggy /connect_token...");
  const data = await pluggyFetch(apiKey, "/connect_token", {
    method: "POST",
    body: JSON.stringify({ clientUserId: userId }),
  });
  console.log("✅ Connect token obtained, accessToken length:", data.accessToken?.length);

  return new Response(JSON.stringify({ accessToken: data.accessToken }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSaveConnection(
  supabase: any,
  userId: string,
  body: any
): Promise<Response> {
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
  return new Response(JSON.stringify({ connection: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSyncTransactions(
  supabase: any,
  userId: string,
  body: any
): Promise<Response> {
  const { connectionId, dateFrom, dateTo } = body;
  const startTime = Date.now();

  // Get connection
  const { data: conn, error: connErr } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("id", connectionId)
    .single();
  if (connErr || !conn) throw new Error("Connection not found");

  // Create upload record
  const { data: upload } = await supabase
    .from("conciliacao_uploads")
    .insert({
      bank_connection_id: connectionId,
      user_id: userId,
      status: "processing",
    })
    .select()
    .single();

  const apiKey = await getPluggyApiKey();

  // Fetch accounts for this item
  const accountsData = await pluggyFetch(apiKey, `/items/${conn.pluggy_item_id}/accounts`);

  let allTransactions: any[] = [];

  for (const account of accountsData.results || []) {
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

  let conciliados = 0;
  let pendentes = 0;
  let divergentes = 0;

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
          (c: any) =>
            c.numero_documento &&
            c.numero_documento === txDoc &&
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
          const diffDays = Math.abs(
            (txDateObj.getTime() - vencDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return (
            diffDays <= 3 &&
            Math.abs(parseFloat(c.valor_aberto || c.valor_original) - txValue) < 0.01
          );
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

      // Auto-mark as paid
      await supabase
        .from("contas_pagar")
        .update({
          status: "Pago",
          valor_pago: txValue,
          data_pagamento: txDate,
        })
        .eq("id", matchedContaPagar.id);

      // Remove from matching pool
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
    });
  }

  // Batch insert conciliacoes
  if (conciliacoes.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < conciliacoes.length; i += batchSize) {
      await supabase
        .from("conciliacoes_bancarias")
        .upsert(conciliacoes.slice(i, i + batchSize), {
          onConflict: "pluggy_transaction_id",
        });
    }
  }

  // Update upload record
  const duracao = Date.now() - startTime;
  await supabase
    .from("conciliacao_uploads")
    .update({
      total_transacoes: allTransactions.length,
      conciliados,
      pendentes,
      divergentes,
      duracao_ms: duracao,
      status: "completed",
    })
    .eq("id", upload.id);

  // Update balance from Pluggy accounts
  const totalBalance = (accountsData.results || []).reduce(
    (sum: number, acc: any) => sum + (acc.balance || 0), 0
  );

  // Update connection last_sync + saldo
  await supabase
    .from("bank_connections")
    .update({
      last_sync: new Date().toISOString(),
      saldo_atual: totalBalance,
      saldo_atualizado_em: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return new Response(
    JSON.stringify({
      total: allTransactions.length,
      conciliados,
      pendentes,
      divergentes,
      duracao_ms: duracao,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleMatchManual(
  supabase: any,
  body: any
): Promise<Response> {
  const { conciliacaoId, contaPagarId } = body;

  const { data: conc, error: concErr } = await supabase
    .from("conciliacoes_bancarias")
    .select("*")
    .eq("id", conciliacaoId)
    .single();
  if (concErr) throw concErr;

  // Update conciliacao
  await supabase
    .from("conciliacoes_bancarias")
    .update({
      conta_pagar_id: contaPagarId,
      status_conciliacao: "conciliado",
      confianca: "manual",
    })
    .eq("id", conciliacaoId);

  // Mark conta_pagar as paid
  await supabase
    .from("contas_pagar")
    .update({
      status: "Pago",
      valor_pago: Math.abs(conc.valor),
      data_pagamento: conc.data_transacao,
    })
    .eq("id", contaPagarId);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleListConnections(supabase: any, userId: string): Promise<Response> {
  const { data, error } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return new Response(JSON.stringify({ connections: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const {
      data: { user },
      error: userErr,
    } = await anonClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        return await handleListConnections(supabase, user.id);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    console.error("conciliacao-bancaria error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
