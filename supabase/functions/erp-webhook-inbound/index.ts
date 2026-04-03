// erp-webhook-inbound — Processa webhooks de retorno do ERP
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { AuthError } from "../_shared/auth.ts";

function json(body: unknown, status: number, req: Request) {
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    status === 401 || status === 403
  );
  return new Response(JSON.stringify(body), { status, headers });
}

const ErpWebhookSchema = z.object({
  evento: z.enum(["provisao_registrada", "baixa_confirmada", "estorno_processado", "erro_processamento"]),
  empresa_id: z.string().min(1).max(200),
  referencia_erp: z.string().min(1).max(500),
  status_erp: z.string().min(1).max(100),
  data_processamento: z.string().min(1).max(100),
  conta_pagar_id: z.string().max(200).optional().nullable(),
  erp_export_queue_id: z.string().max(200).optional().nullable(),
  mensagem: z.string().max(2000).optional().nullable(),
  valor_processado: z.number().optional().nullable(),
});

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") return json({ sucesso: false, mensagem: "Método não permitido" }, 405, req);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Auth: API Key validation with hash support (SEG-2)
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return json({ sucesso: false, mensagem: "x-api-key obrigatório" }, 401, req);

  // Hash the incoming key for comparison
  const keyData = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  const apiKeyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  let rawBody: string;
  let payload: any;
  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch {
    return json({ sucesso: false, mensagem: "Body inválido" }, 400, req);
  }

  // Validate payload with Zod (SEG-4)
  try {
    payload = validateBody(payload, ErpWebhookSchema);
  } catch (e: any) {
    return json({ sucesso: false, mensagem: "Payload inválido", details: e.issues }, 400, req);
  }

  // Validate API key: hash-based first, plaintext fallback during transition (SEG-2)
  const { data: erpConfig } = await supabase
    .from("erp_config")
    .select("id, empresa_id")
    .eq("ativo", true)
    .or(`api_key_hash.eq.${apiKeyHash},api_key.eq.${apiKey},and(api_key_anterior.eq.${apiKey},api_key_anterior_expira_em.gt.${new Date().toISOString()})`)
    .maybeSingle();

  // Fallback: check erp_api_keys table
  let erpConfigResult = erpConfig;
  if (!erpConfigResult) {
    const { validateErpApiKey } = await import("../_shared/erp-key-validator.ts");
    const empresa = await validateErpApiKey(apiKey);
    if (empresa) erpConfigResult = { id: "erp_api_keys", empresa_id: empresa };
  }

  if (!erpConfigResult) return json({ sucesso: false, erro: "empresa nao autorizada", mensagem: "Chave API inválida ou inativa" }, 401, req);

  if (erpConfigResult.empresa_id !== payload.empresa_id) {
    return json({ sucesso: false, erro: "empresa nao autorizada", mensagem: "empresa_id não corresponde à chave API fornecida" }, 403, req);
  }

  // Rate limiting (SEG-5)
  const { data: permitido } = await supabase.rpc("check_and_increment_rate_limit", {
    p_chave: `erp-webhook-${payload.empresa_id}`,
    p_limite: 60,
  });
  if (permitido === false) {
    return json({ sucesso: false, erro: "limite_excedido", mensagem: "Limite de 60 requisições/minuto excedido" }, 429, req);
  }

  // Idempotency
  const headerIdempotencyKey = req.headers.get("x-idempotency-key");
  const idempotencyKey = headerIdempotencyKey ?? `${payload.empresa_id}-${payload.evento}-${payload.referencia_erp}-${payload.data_processamento}`;

  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existe } = await supabase
    .from("erp_sync_log")
    .select("id")
    .eq("empresa_id", payload.empresa_id)
    .eq("idempotency_key", idempotencyKey)
    .gte("created_at", seteDiasAtras)
    .maybeSingle();
  if (existe) return json({ sucesso: true, status: "ja_processado", id: existe.id, idempotente: true }, 200, req);

  const statusMap: Record<string, string> = {
    provisao_registrada: "confirmado_erp",
    baixa_confirmada: "baixado_erp",
    estorno_processado: "estornado_erp",
    erro_processamento: "erro_erp",
  };
  const novoStatus = statusMap[payload.evento];

  let contaPagarId = payload.conta_pagar_id || null;
  if (!contaPagarId && payload.referencia_erp) {
    const { data: cp } = await supabase
      .from("contas_pagar")
      .select("id")
      .eq("empresa_id", payload.empresa_id)
      .eq("numero_documento", payload.referencia_erp)
      .maybeSingle();
    if (cp) contaPagarId = cp.id;
  }

  let filaAtualizada = false;
  if (payload.erp_export_queue_id) {
    const updateData: any = {
      erp_sync_status: novoStatus,
      erp_referencia: payload.referencia_erp,
      erp_synced_at: payload.data_processamento,
    };
    if (payload.mensagem) updateData.erp_mensagem = payload.mensagem;
    const { error } = await supabase
      .from("erp_export_queue")
      .update(updateData)
      .eq("id", payload.erp_export_queue_id)
      .eq("empresa_id", payload.empresa_id);
    filaAtualizada = !error;
  } else if (contaPagarId) {
    const { error } = await supabase
      .from("erp_export_queue")
      .update({ erp_sync_status: novoStatus, erp_referencia: payload.referencia_erp, erp_synced_at: payload.data_processamento })
      .eq("conta_pagar_id", contaPagarId)
      .eq("empresa_id", payload.empresa_id)
      .in("erp_sync_status", ["pendente", "enviado", "confirmado_erp"]);
    filaAtualizada = !error;
  }

  // Auto-payment on baixa_confirmada
  let contaJaPaga = false;
  let contaAtualizada = false;
  if (payload.evento === "baixa_confirmada" && contaPagarId) {
    const { data: contaAtual } = await supabase
      .from("contas_pagar")
      .select("status, valor_original")
      .eq("id", contaPagarId)
      .maybeSingle();

    if (contaAtual && contaAtual.status === "pago") {
      contaJaPaga = true;
    } else if (contaAtual) {
      const valorPago = payload.valor_processado || contaAtual.valor_original || 0;
      const { error: updErr } = await supabase
        .from("contas_pagar")
        .update({ valor_pago: valorPago, valor_aberto: 0, baixa_origem: "erp_webhook", data_baixa: payload.data_processamento, data_pagamento: payload.data_processamento })
        .eq("id", contaPagarId);
      contaAtualizada = !updErr;
    }
  }

  const { data: logEntry } = await supabase
    .from("erp_sync_log")
    .insert({
      entity_type: "conta_pagar", entity_id: contaPagarId || null, action: payload.evento,
      direction: "inbound", empresa_id: payload.empresa_id, tipo: "inbound_webhook",
      evento: payload.evento, referencia_erp: payload.referencia_erp, conta_pagar_id: contaPagarId,
      payload_entrada: payload, fila_atualizada: filaAtualizada, conta_atualizada: contaAtualizada,
      conta_ja_paga: contaJaPaga, idempotency_key: idempotencyKey || null,
      data_processamento_erp: payload.data_processamento, success: true,
    })
    .select("id")
    .single();

  return json({
    sucesso: true,
    mensagem: "Evento '" + payload.evento + "' processado com sucesso",
    evento_id: logEntry?.id ?? "sem-log",
    fila_atualizada: filaAtualizada,
  }, 200, req);
});
