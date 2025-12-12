import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: any[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  // Buscar configurações do WhatsApp Business
  const whatsappToken = Deno.env.get("WHATSAPP_BUSINESS_TOKEN");
  const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const whatsappVerifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  // ============ VERIFICAÇÃO DO WEBHOOK (Meta) ============
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    if (mode === "subscribe" && token === whatsappVerifyToken) {
      console.log("[WhatsApp Business] Webhook verificado com sucesso");
      return new Response(challenge, { status: 200 });
    }
    
    return new Response(JSON.stringify({ 
      status: "ok",
      service: "whatsapp-business-api",
      endpoints: ["/send", "/send-template", "/webhook", "/templates"]
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // ============ RECEBER MENSAGENS (Webhook do Meta) ============
  if (path === "webhook" && req.method === "POST") {
    try {
      const body = await req.json();
      console.log("[WhatsApp Business] Webhook recebido:", JSON.stringify(body));

      // Processar mensagens recebidas
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        for (const message of value.messages) {
          const from = message.from;
          const text = message.text?.body || '';
          const messageId = message.id;
          const timestamp = message.timestamp;

          console.log(`[WhatsApp Business] Mensagem de ${from}: ${text}`);

          // Salvar mensagem recebida no banco
          await supabase.from("whatsapp_messages").insert({
            phone_number: from,
            direction: 'incoming',
            message_text: text,
            message_id: messageId,
            status: 'received',
            received_at: new Date(parseInt(timestamp) * 1000).toISOString()
          });

          // Verificar se é resposta de cobrança
          const { data: pendingCobranca } = await supabase
            .from("cobrancas_enviadas")
            .select("*")
            .eq("destinatario", from)
            .eq("status_resposta", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (pendingCobranca) {
            // Atualizar status da cobrança
            await supabase.from("cobrancas_enviadas")
              .update({
                status_resposta: 'respondido',
                respondido_em: new Date().toISOString()
              })
              .eq("id", pendingCobranca.id);

            console.log(`[WhatsApp Business] Resposta de cobrança registrada: ${pendingCobranca.id}`);
          }
        }
      }

      // Processar status de mensagens
      if (value?.statuses) {
        for (const status of value.statuses) {
          const messageId = status.id;
          const statusValue = status.status;

          console.log(`[WhatsApp Business] Status ${messageId}: ${statusValue}`);

          // Atualizar status no banco
          await supabase.from("whatsapp_messages")
            .update({ status: statusValue })
            .eq("message_id", messageId);

          // Atualizar cobrança se aplicável
          if (statusValue === 'delivered' || statusValue === 'read') {
            await supabase.from("cobrancas_enviadas")
              .update({
                status_envio: statusValue,
                entregue_em: statusValue === 'delivered' ? new Date().toISOString() : undefined,
                lido_em: statusValue === 'read' ? new Date().toISOString() : undefined
              })
              .eq("provider_id", messageId);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      const error = err as Error;
      console.error("[WhatsApp Business] Erro no webhook:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // ============ ENVIAR MENSAGEM DE TEXTO ============
  if (path === "send" && req.method === "POST") {
    try {
      if (!whatsappToken || !whatsappPhoneId) {
        throw new Error("WhatsApp Business API não configurada. Configure WHATSAPP_BUSINESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID");
      }

      const body = await req.json();
      const { to, message, fila_id } = body;

      // Formatar número (remover caracteres especiais, adicionar código do país)
      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.startsWith('55')) {
        formattedNumber = '55' + formattedNumber;
      }

      console.log(`[WhatsApp Business] Enviando para ${formattedNumber}`);

      const whatsappPayload: WhatsAppMessage = {
        to: formattedNumber,
        type: 'text',
        text: { body: message }
      };

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${whatsappToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            ...whatsappPayload
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Erro ao enviar mensagem');
      }

      const messageId = result.messages?.[0]?.id;

      // Salvar mensagem enviada
      await supabase.from("whatsapp_messages").insert({
        phone_number: formattedNumber,
        direction: 'outgoing',
        message_text: message,
        message_id: messageId,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      // Atualizar fila de cobrança se aplicável
      if (fila_id) {
        await supabase.from("fila_cobrancas")
          .update({ 
            status: "enviado",
            updated_at: new Date().toISOString()
          })
          .eq("id", fila_id);

        await supabase.from("cobrancas_enviadas").insert({
          fila_id,
          canal: "whatsapp",
          destinatario: formattedNumber,
          mensagem: message,
          status_envio: "enviado",
          enviado_em: new Date().toISOString(),
          provider_id: messageId,
          provider_response: result
        });
      }

      console.log(`[WhatsApp Business] Mensagem enviada: ${messageId}`);

      return new Response(JSON.stringify({ 
        success: true, 
        message_id: messageId 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      const error = err as Error;
      console.error("[WhatsApp Business] Erro ao enviar:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // ============ ENVIAR TEMPLATE (para cobranças) ============
  if (path === "send-template" && req.method === "POST") {
    try {
      if (!whatsappToken || !whatsappPhoneId) {
        throw new Error("WhatsApp Business API não configurada");
      }

      const body = await req.json();
      const { to, template_name, template_language, components, fila_id } = body;

      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.startsWith('55')) {
        formattedNumber = '55' + formattedNumber;
      }

      console.log(`[WhatsApp Business] Enviando template ${template_name} para ${formattedNumber}`);

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${whatsappToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedNumber,
            type: "template",
            template: {
              name: template_name,
              language: { code: template_language || "pt_BR" },
              components: components || []
            }
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Erro ao enviar template');
      }

      const messageId = result.messages?.[0]?.id;

      // Salvar template enviado
      await supabase.from("whatsapp_messages").insert({
        phone_number: formattedNumber,
        direction: 'outgoing',
        message_text: `[Template: ${template_name}]`,
        message_id: messageId,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      // Atualizar fila de cobrança se aplicável
      if (fila_id) {
        await supabase.from("fila_cobrancas")
          .update({ 
            status: "enviado",
            updated_at: new Date().toISOString()
          })
          .eq("id", fila_id);

        await supabase.from("cobrancas_enviadas").insert({
          fila_id,
          canal: "whatsapp",
          destinatario: formattedNumber,
          mensagem: `[Template: ${template_name}]`,
          status_envio: "enviado",
          enviado_em: new Date().toISOString(),
          provider_id: messageId,
          provider_response: result
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message_id: messageId 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      const error = err as Error;
      console.error("[WhatsApp Business] Erro ao enviar template:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // ============ LISTAR TEMPLATES ============
  if (path === "templates" && req.method === "GET") {
    try {
      if (!whatsappToken) {
        throw new Error("WhatsApp Business API não configurada");
      }

      const businessId = Deno.env.get("WHATSAPP_BUSINESS_ID");
      if (!businessId) {
        throw new Error("WHATSAPP_BUSINESS_ID não configurado");
      }

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${businessId}/message_templates`,
        {
          headers: {
            "Authorization": `Bearer ${whatsappToken}`,
          },
        }
      );

      const result = await response.json();

      return new Response(JSON.stringify({ 
        success: true, 
        templates: result.data || []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      const error = err as Error;
      console.error("[WhatsApp Business] Erro ao listar templates:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // ============ HEALTH CHECK ============
  if (path === "health") {
    const configured = !!(whatsappToken && whatsappPhoneId);
    
    return new Response(JSON.stringify({ 
      status: configured ? "healthy" : "not_configured",
      configured,
      has_token: !!whatsappToken,
      has_phone_id: !!whatsappPhoneId,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Endpoint não encontrado" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
