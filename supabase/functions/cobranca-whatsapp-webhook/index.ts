import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  // Buscar configuração para validar tokens
  const { data: configData } = await supabase
    .from("configuracoes_cobranca")
    .select("api_key, whatsapp_verify_token, automacao_ativa")
    .single();

  // ============ VERIFICAÇÃO DO WEBHOOK (Meta/Twilio) ============
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    const verifyToken = configData?.whatsapp_verify_token;
    
    if (mode === "subscribe" && token === verifyToken) {
      console.log("[Cobrança WhatsApp] Webhook verificado com sucesso");
      return new Response(challenge, { status: 200 });
    }
    
    // Retornar info básica se não for verificação
    return new Response(JSON.stringify({ 
      status: "ok",
      service: "cobranca-whatsapp-webhook",
      endpoints: ["/status", "/enviar", "/pendentes-whatsapp"]
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  }

  // ============ RECEBER STATUS DE ENTREGA ============
  if (path === "status" && req.method === "POST") {
    try {
      const body = await req.json();
      console.log("[Cobrança WhatsApp] Status recebido:", JSON.stringify(body));
      
      // Formato N8N ou integração externa
      const { fila_id, message_id, status, error_message, delivered_at, read_at } = body;
      
      if (fila_id) {
        // Mapear status externo para status interno
        let newStatus = "processando";
        if (status === "delivered" || status === "sent") {
          newStatus = "enviado";
        } else if (status === "read") {
          newStatus = "enviado";
        } else if (status === "failed" || status === "error") {
          newStatus = "erro";
        }
        
        // Atualizar status na fila
        await supabase.from("fila_cobrancas")
          .update({ 
            status: newStatus, 
            erro_mensagem: error_message || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", fila_id);
        
        // Atualizar histórico de envio
        await supabase.from("cobrancas_enviadas")
          .update({
            status_envio: status,
            entregue_em: delivered_at || null,
            lido_em: read_at || null,
            provider_response: body,
            provider_id: message_id || null
          })
          .eq("fila_id", fila_id);
        
        console.log(`[Cobrança WhatsApp] Fila ${fila_id} atualizada para status: ${newStatus}`);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    } catch (err) {
      const error = err as Error;
      console.error("[Cobrança WhatsApp] Erro ao processar status:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }
  }

  // ============ ENVIAR WHATSAPP VIA INTEGRAÇÃO EXTERNA ============
  if (path === "enviar" && req.method === "POST") {
    const apiKey = req.headers.get("x-api-key");
    const validKey = configData?.api_key;
    
    if (!validKey || apiKey !== validKey) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }
    
    try {
      const body = await req.json();
      const { fila_id, telefone, mensagem, template_name } = body;
      
      console.log(`[Cobrança WhatsApp] Solicitação de envio para fila ${fila_id}`);
      
      // Verificar se tem Twilio configurado
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
      
      if (twilioAccountSid && twilioAuthToken && twilioNumber) {
        // Enviar via Twilio diretamente
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: `whatsapp:${twilioNumber}`,
              To: `whatsapp:${telefone}`,
              Body: mensagem,
            }),
          }
        );
        
        const result = await response.json();
        
        // Atualizar fila
        await supabase.from("fila_cobrancas")
          .update({ 
            status: response.ok ? "enviado" : "erro",
            erro_mensagem: response.ok ? null : result.message,
            updated_at: new Date().toISOString()
          })
          .eq("id", fila_id);
        
        // Registrar envio
        if (response.ok) {
          await supabase.from("cobrancas_enviadas").insert({
            fila_id,
            canal: "whatsapp",
            destinatario: telefone,
            mensagem,
            status_envio: "enviado",
            enviado_em: new Date().toISOString(),
            provider_id: result.sid,
            provider_response: result
          });
        }
        
        return new Response(JSON.stringify({ 
          success: response.ok, 
          provider: "twilio",
          provider_id: result.sid 
        }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        });
      }
      
      // Se não tem Twilio configurado, retorna dados para N8N processar
      return new Response(JSON.stringify({ 
        success: true, 
        mode: "n8n_required",
        message: "Twilio não configurado. Use /pendentes-whatsapp para buscar via N8N",
        data: { fila_id, telefone, mensagem, template_name }
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    } catch (err) {
      const error = err as Error;
      console.error("[Cobrança WhatsApp] Erro ao enviar:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }
  }

  // ============ BUSCAR WHATSAPPS PENDENTES (para N8N) ============
  if (path === "pendentes-whatsapp" && req.method === "GET") {
    const apiKey = req.headers.get("x-api-key");
    const validKey = configData?.api_key;
    
    if (!validKey || apiKey !== validKey) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }
    
    try {
      const limit = parseInt(url.searchParams.get("limit") || "20");
      
      const { data, error } = await supabase
        .from("fila_cobrancas")
        .select(`
          *,
          conta:contas_receber(valor_aberto, data_vencimento, dias_atraso, cliente_nome)
        `)
        .eq("status", "pendente")
        .eq("canal", "whatsapp")
        .lte("agendado_para", new Date().toISOString())
        .order("prioridade", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // Marcar como processando
      if (data && data.length > 0) {
        const ids = data.map(d => d.id);
        await supabase.from("fila_cobrancas")
          .update({ status: "processando", updated_at: new Date().toISOString() })
          .in("id", ids);
        
        console.log(`[Cobrança WhatsApp] ${data.length} itens marcados como processando`);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        count: data?.length || 0,
        data 
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    } catch (err) {
      const error = err as Error;
      console.error("[Cobrança WhatsApp] Erro ao buscar pendentes:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }
  }

  // ============ HEALTH CHECK ============
  if (path === "health") {
    return new Response(JSON.stringify({ 
      status: "healthy",
      automacao_ativa: configData?.automacao_ativa || false,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Endpoint não encontrado" }), {
    status: 404,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
  });
});
