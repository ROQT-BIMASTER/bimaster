import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ sucesso: false, mensagem: "Método não permitido" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return json({ sucesso: false, mensagem: "x-api-key obrigatório" }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ sucesso: false, mensagem: "Body inválido" }, 400); }

  for (const campo of ["evento", "empresa_id", "referencia_erp", "status_erp", "data_processamento"]) {
    if (payload[campo] == null) return json({ sucesso: false, mensagem: "Campo obrigatório ausente: " + campo }, 400);
  }

  const eventosValidos = ["provisao_registrada", "baixa_confirmada", "estorno_processado", "erro_processamento"];
  if (!eventosValidos.includes(payload.evento)) {
    return json({ sucesso: false, mensagem: "Evento inválido: " + payload.evento }, 400);
  }

  const { data: erpConfig } = await supabase
    .from("erp_config")
    .select("id, empresa_id")
    .eq("empresa_id", payload.empresa_id)
    .eq("api_key", apiKey)
    .eq("ativo", true)
    .maybeSingle();

  if (!erpConfig) return json({ sucesso: false, mensagem: "Não autorizado" }, 401);

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (idempotencyKey) {
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existe } = await supabase
      .from("erp_sync_log")
      .select("id")
      .eq("empresa_id", payload.empresa_id)
      .eq("idempotency_key", idempotencyKey)
      .gte("created_at", seteDiasAtras)
      .maybeSingle();
    if (existe) return json({ sucesso: true, mensagem: "Evento já processado", evento_id: existe.id, idempotente: true }, 200);
  }

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
      .update({
        erp_sync_status: novoStatus,
        erp_referencia: payload.referencia_erp,
        erp_synced_at: payload.data_processamento,
      })
      .eq("conta_pagar_id", contaPagarId)
      .eq("empresa_id", payload.empresa_id)
      .in("erp_sync_status", ["pendente", "enviado", "confirmado_erp"]);
    filaAtualizada = !error;
  }

  // AJUSTE 2: Baixa automática em contas_pagar quando evento = baixa_confirmada
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
        .update({
          valor_pago: valorPago,
          valor_aberto: 0,
          baixa_origem: "erp_webhook",
          data_baixa: payload.data_processamento,
          data_pagamento: payload.data_processamento,
        })
        .eq("id", contaPagarId);
      contaAtualizada = !updErr;
    }
  }

  const { data: logEntry } = await supabase
    .from("erp_sync_log")
    .insert({
      entity_type: "conta_pagar",
      entity_id: contaPagarId || null,
      action: payload.evento,
      direction: "inbound",
      empresa_id: payload.empresa_id,
      tipo: "inbound_webhook",
      evento: payload.evento,
      referencia_erp: payload.referencia_erp,
      conta_pagar_id: contaPagarId,
      payload_entrada: payload,
      fila_atualizada: filaAtualizada,
      conta_atualizada: contaAtualizada,
      conta_ja_paga: contaJaPaga,
      idempotency_key: idempotencyKey || null,
      data_processamento_erp: payload.data_processamento,
      success: true,
    })
    .select("id")
    .single();

  return json({
    sucesso: true,
    mensagem: "Evento '" + payload.evento + "' processado com sucesso",
    evento_id: logEntry?.id ?? "sem-log",
    fila_atualizada: filaAtualizada,
  }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
