import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface para o contexto da conversa
interface ConversationContext {
  step: string;
  store_id?: string;
  store_name?: string;
  visit_date?: string;
  photo_before?: string;
  photo_after?: string;
  our_facings?: number;
  competitor_facings?: number;
  notes?: string;
  pending_photo?: 'before' | 'after';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const whatsappToken = Deno.env.get("WHATSAPP_API_TOKEN");
    const whatsappVerifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificação do webhook (necessário para configurar no WhatsApp)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === whatsappVerifyToken) {
        console.log("Webhook verificado com sucesso");
        return new Response(challenge, { status: 200 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    // Processar mensagens recebidas
    const body = await req.json();
    console.log("Webhook recebido:", JSON.stringify(body));

    // Extrair dados da mensagem (formato Twilio ou Meta)
    let phoneNumber: string;
    let messageText: string | null = null;
    let mediaUrl: string | null = null;
    let messageId: string;

    // Detectar formato (Twilio ou Meta WhatsApp)
    if (body.entry && body.entry[0]?.changes) {
      // Meta WhatsApp Business API
      const change = body.entry[0].changes[0];
      const message = change.value?.messages?.[0];
      
      if (!message) {
        return new Response(JSON.stringify({ status: "no_message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      phoneNumber = message.from;
      messageId = message.id;
      
      if (message.type === "text") {
        messageText = message.text?.body;
      } else if (message.type === "image") {
        mediaUrl = message.image?.id; // ID da mídia no Meta
      }
    } else if (body.From && body.Body !== undefined) {
      // Twilio
      phoneNumber = body.From.replace("whatsapp:", "");
      messageText = body.Body || null;
      mediaUrl = body.MediaUrl0 || null;
      messageId = body.MessageSid;
    } else {
      return new Response(JSON.stringify({ status: "invalid_format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Mensagem de ${phoneNumber}: ${messageText || "[mídia]"}`);

    // Buscar ou criar usuário baseado no número de telefone
    const { data: userWhatsapp } = await supabase
      .from("user_whatsapp")
      .select("user_id, profiles(nome)")
      .eq("phone_number", phoneNumber)
      .single();

    if (!userWhatsapp) {
      // Usuário não vinculado
      await sendWhatsAppMessage(
        phoneNumber,
        "Olá! Para usar este serviço, primeiro você precisa vincular seu número de WhatsApp no sistema. Acesse Configurações > WhatsApp no aplicativo.",
        whatsappToken
      );
      return new Response(JSON.stringify({ status: "user_not_linked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userWhatsapp.user_id;

    // Buscar ou criar conversa ativa
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      // Criar nova conversa
      const { data: newConv } = await supabase
        .from("whatsapp_conversations")
        .insert({
          user_id: userId,
          phone_number: phoneNumber,
          context: { step: "inicio" },
          status: "active",
        })
        .select()
        .single();
      conversation = newConv;
    }

    // Registrar mensagem do usuário
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      message_id: messageId,
      sender: "user",
      content: messageText || "[mídia]",
      media_url: mediaUrl,
      media_type: mediaUrl ? "image" : null,
    });

    // Processar comando ou continuar fluxo
    const context = conversation.context as ConversationContext;
    let response: string;
    let newContext = { ...context };

    // Se recebeu foto
    if (mediaUrl) {
      if (context.pending_photo === "before") {
        newContext.photo_before = mediaUrl;
        newContext.pending_photo = undefined;
        newContext.step = "aguardando_foto_depois";
        response = "✅ Foto ANTES recebida! Agora envie a foto DEPOIS da execução.";
      } else if (context.pending_photo === "after") {
        newContext.photo_after = mediaUrl;
        newContext.pending_photo = undefined;
        newContext.step = "aguardando_faces_nossas";
        response = "✅ Foto DEPOIS recebida! Quantas faces do nosso produto você colocou?";
      } else {
        response = "Não estava esperando uma foto neste momento. Use /novo para iniciar um novo lançamento.";
      }
    }
    // Se recebeu texto
    else if (messageText) {
      // Comandos especiais
      if (messageText.toLowerCase() === "/novo" || messageText.toLowerCase() === "/iniciar") {
        newContext = { step: "escolher_loja" };
        response = await gerarRespostaIA(
          "O usuário quer iniciar um novo lançamento rápido. Seja amigável e peça para ele dizer qual loja está visitando (nome ou ID).",
          [],
          lovableApiKey
        );
      } else if (messageText.toLowerCase() === "/cancelar") {
        await supabase
          .from("whatsapp_conversations")
          .update({ status: "cancelled" })
          .eq("id", conversation.id);
        response = "Lançamento cancelado. Use /novo quando quiser iniciar outro.";
      } else if (messageText.toLowerCase() === "/ajuda") {
        response = `📱 *Comandos disponíveis:*
/novo - Iniciar novo lançamento
/cancelar - Cancelar lançamento atual
/ajuda - Ver esta mensagem

Para iniciar um lançamento, basta digitar /novo e eu vou te guiar passo a passo!`;
      } else {
        // Processar baseado no passo atual
        response = await processarMensagem(
          messageText,
          context,
          userId,
          lovableApiKey,
          supabase
        );
        
        // Atualizar contexto baseado no processamento
        newContext = await atualizarContexto(context, messageText, supabase);
      }
    } else {
      response = "Desculpe, não entendi. Use /ajuda para ver os comandos disponíveis.";
    }

    // Atualizar contexto da conversa
    await supabase
      .from("whatsapp_conversations")
      .update({ context: newContext })
      .eq("id", conversation.id);

    // Registrar resposta do bot
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      sender: "bot",
      content: response,
    });

    // Enviar resposta via WhatsApp
    await sendWhatsAppMessage(phoneNumber, response, whatsappToken);

    // Verificar se o lançamento está completo
    if (isLancamentoCompleto(newContext)) {
      await criarLancamentoRapido(newContext, userId, supabase);
      await supabase
        .from("whatsapp_conversations")
        .update({ status: "completed" })
        .eq("id", conversation.id);
      
      await sendWhatsAppMessage(
        phoneNumber,
        "✅ *Lançamento criado com sucesso!* Você pode ver os detalhes no aplicativo. Use /novo para fazer outro lançamento.",
        whatsappToken
      );
    }

    return new Response(JSON.stringify({ status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro no webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processarMensagem(
  messageText: string,
  context: ConversationContext,
  userId: string,
  lovableApiKey: string,
  supabase: any
): Promise<string> {
  const step = context.step;

  if (step === "inicio" || step === "escolher_loja") {
    // Buscar lojas do usuário usando IA
    const { data: stores } = await supabase
      .from("stores")
      .select("id, name, address, city")
      .or(`created_by.eq.${userId},vendedor_id.eq.${userId}`)
      .limit(20);

    const storesList = stores?.map((s: any) => `${s.name} (${s.city})`).join("\n") || "Nenhuma loja encontrada";

    return await gerarRespostaIA(
      `O usuário disse: "${messageText}". Ajude-o a escolher uma loja da lista. Seja objetivo e amigável. Lojas disponíveis:\n${storesList}`,
      [{ role: "user", content: messageText }],
      lovableApiKey
    );
  }

  if (step === "aguardando_data") {
    return "Qual a data da visita? (formato: DD/MM/AAAA ou 'hoje')";
  }

  if (step === "aguardando_foto_antes") {
    return "Envie a foto ANTES da execução do trabalho.";
  }

  if (step === "aguardando_foto_depois") {
    return "Agora envie a foto DEPOIS da execução.";
  }

  if (step === "aguardando_faces_nossas") {
    return "Quantas faces do nosso produto você colocou?";
  }

  if (step === "aguardando_faces_concorrente") {
    return "Quantas faces do concorrente você viu?";
  }

  if (step === "aguardando_observacoes") {
    return "Alguma observação sobre a visita? (ou digite 'não' para pular)";
  }

  return "Desculpe, estou perdido. Use /novo para recomeçar.";
}

async function atualizarContexto(
  context: ConversationContext,
  messageText: string,
  supabase: any
): Promise<ConversationContext> {
  const newContext = { ...context };

  if (context.step === "escolher_loja") {
    // Tentar encontrar loja pelo nome ou ID
    const { data: store } = await supabase
      .from("stores")
      .select("id, name")
      .or(`name.ilike.%${messageText}%,id.eq.${messageText}`)
      .limit(1)
      .single();

    if (store) {
      newContext.store_id = store.id;
      newContext.store_name = store.name;
      newContext.step = "aguardando_data";
    } else {
      newContext.step = "escolher_loja"; // Tentar novamente
    }
  } else if (context.step === "aguardando_data") {
    const date = parseDate(messageText);
    if (date) {
      newContext.visit_date = date;
      newContext.step = "aguardando_foto_antes";
      newContext.pending_photo = "before";
    }
  } else if (context.step === "aguardando_faces_nossas") {
    const faces = parseInt(messageText);
    if (!isNaN(faces) && faces >= 0) {
      newContext.our_facings = faces;
      newContext.step = "aguardando_faces_concorrente";
    }
  } else if (context.step === "aguardando_faces_concorrente") {
    const faces = parseInt(messageText);
    if (!isNaN(faces) && faces >= 0) {
      newContext.competitor_facings = faces;
      newContext.step = "aguardando_observacoes";
    }
  } else if (context.step === "aguardando_observacoes") {
    if (messageText.toLowerCase() !== "não" && messageText.toLowerCase() !== "nao") {
      newContext.notes = messageText;
    }
    newContext.step = "completo";
  }

  return newContext;
}

function parseDate(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  if (lowerText === "hoje" || lowerText === "today") {
    return new Date().toISOString().split("T")[0];
  }
  
  // Formato DD/MM/AAAA
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const [_, day, month, year] = dateMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  return null;
}

function isLancamentoCompleto(context: ConversationContext): boolean {
  return (
    context.step === "completo" &&
    !!context.store_id &&
    !!context.visit_date &&
    !!context.photo_before &&
    !!context.photo_after &&
    context.our_facings !== undefined &&
    context.competitor_facings !== undefined
  );
}

async function criarLancamentoRapido(
  context: ConversationContext,
  userId: string,
  supabase: any
): Promise<void> {
  try {
    // Criar visita
    const { data: visit } = await supabase
      .from("visits")
      .insert({
        store_id: context.store_id,
        user_id: userId,
        visit_date: context.visit_date,
        status: "completed",
        notes: context.notes,
      })
      .select()
      .single();

    if (!visit) throw new Error("Falha ao criar visita");

    // Registrar fotos
    const photosToInsert = [];
    if (context.photo_before) {
      photosToInsert.push({
        visit_id: visit.id,
        store_id: context.store_id,
        photo_url: context.photo_before,
        vendedor_id: userId,
        photo_type: "before",
        our_facings: 0,
        competitor_facings: 0,
      });
    }
    if (context.photo_after) {
      photosToInsert.push({
        visit_id: visit.id,
        store_id: context.store_id,
        photo_url: context.photo_after,
        vendedor_id: userId,
        photo_type: "after",
        our_facings: context.our_facings || 0,
        competitor_facings: context.competitor_facings || 0,
      });
    }

    if (photosToInsert.length > 0) {
      await supabase.from("photos").insert(photosToInsert);
    }

    console.log(`Lançamento criado com sucesso para visita ${visit.id}`);
  } catch (error) {
    console.error("Erro ao criar lançamento:", error);
    throw error;
  }
}

async function sendWhatsAppMessage(
  to: string,
  message: string,
  token: string | undefined
): Promise<void> {
  if (!token) {
    console.log("Token do WhatsApp não configurado, pulando envio");
    return;
  }

  try {
    // Detectar se é Twilio ou Meta baseado no formato do token
    const isTwilio = token.includes("SK") || token.includes("AC");

    if (isTwilio) {
      // Twilio API
      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
      
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${accountSid}:${token}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: `whatsapp:${twilioNumber}`,
            To: `whatsapp:${to}`,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Twilio error: ${await response.text()}`);
      }
    } else {
      // Meta WhatsApp Business API
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      
      const response = await fetch(
        `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to,
            type: "text",
            text: { body: message },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${await response.text()}`);
      }
    }

    console.log(`Mensagem enviada para ${to}`);
  } catch (error) {
    console.error("Erro ao enviar mensagem WhatsApp:", error);
  }
}

async function gerarRespostaIA(
  prompt: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string | undefined
): Promise<string> {
  if (!apiKey) {
    return "Desculpe, o serviço de IA não está configurado no momento.";
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de vendas que ajuda promotores a registrar lançamentos rápidos via WhatsApp. 
Seja conciso, amigável e objetivo. Use emojis ocasionalmente. 
Sempre confirme as informações recebidas e guie o usuário no próximo passo.`,
          },
          { role: "user", content: prompt },
          ...messages,
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
  } catch (error) {
    console.error("Erro ao gerar resposta IA:", error);
    return "Desculpe, ocorreu um erro. Tente novamente.";
  }
}
