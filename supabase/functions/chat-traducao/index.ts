// chat-traducao — traduz uma mensagem do chat corporativo para pt/en/cn.
//
// Fluxo:
//  1. Valida que o usuário invocador é participante ativo da conversa
//     da mensagem (defense in depth — RLS já protege, mas garantimos
//     antes de gastar IA).
//  2. Verifica cache em mensagens_traducoes — se já existe, retorna.
//  3. Chama Lovable AI Gateway (Gemini Flash) com prompt focado em
//     tradução conservadora (preserva formatação, tom e nomes próprios).
//  4. Salva resultado no cache.
//  5. Retorna { texto, cached }.
//
// Custo: ~$0.0001 por mensagem traduzida (Gemini Flash). Sob demanda
// + cache permanente.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logger } from "../_shared/logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

const IDIOMA_NOMES: Record<string, string> = {
  pt: "Portuguese (Brazil)",
  en: "English",
  cn: "Chinese (Simplified Mandarin)",
};

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default secureHandler(
  { auth: "jwt", rateLimit: 60, rateLimitPrefix: "chat-traducao" },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: { mensagem_id?: string; idioma?: string } = {};
    try { body = await req.json(); } catch {
      return jsonResponse({ error: "JSON inválido" }, 400, corsHeaders);
    }

    const { mensagem_id, idioma } = body;
    if (!mensagem_id || !idioma || !(idioma in IDIOMA_NOMES)) {
      return jsonResponse(
        { error: "mensagem_id e idioma (pt|en|cn) são obrigatórios" },
        400,
        corsHeaders,
      );
    }

    const uid = ctx.userId!;

    // 1. Carrega mensagem + valida participação
    const { data: msg, error: msgErr } = await admin
      .from("mensagens")
      .select("id, conversa_id, conteudo, tipo")
      .eq("id", mensagem_id)
      .maybeSingle();
    if (msgErr || !msg) {
      return jsonResponse({ error: "Mensagem não encontrada" }, 404, corsHeaders);
    }
    if (!msg.conteudo || msg.conteudo.trim().length < 2) {
      return jsonResponse({ error: "Mensagem sem texto para traduzir" }, 400, corsHeaders);
    }

    const { data: participante } = await admin
      .from("conversas_participantes")
      .select("usuario_id")
      .eq("conversa_id", msg.conversa_id)
      .eq("usuario_id", uid)
      .is("saiu_em", null)
      .maybeSingle();
    if (!participante) {
      return jsonResponse({ error: "Sem permissão para esta conversa" }, 403, corsHeaders);
    }

    // 2. Cache hit?
    const { data: cached } = await admin
      .from("mensagens_traducoes")
      .select("texto")
      .eq("mensagem_id", mensagem_id)
      .eq("idioma", idioma)
      .maybeSingle();
    if (cached?.texto) {
      return jsonResponse({ texto: cached.texto, cached: true }, 200, corsHeaders);
    }

    // 3. Chama IA
    const r = await callAIGateway({
      model: MODEL,
      timeoutMs: 30_000,
      messages: [
        {
          role: "system",
          content:
            `You are a professional translator for an internal corporate chat. ` +
            `Translate the user message into ${IDIOMA_NOMES[idioma]}. ` +
            `Rules: preserve formatting (line breaks, lists, markdown), preserve emojis, ` +
            `preserve proper names and product/code names as-is, keep the same tone ` +
            `(formal/informal) as the original. Output ONLY the translated text, ` +
            `with no preamble, no quotes, no explanation.`,
        },
        { role: "user", content: msg.conteudo },
      ],
    });

    if (r.kind !== "ok") {
      logger.error("chat-traducao IA falhou", { kind: r.kind, mensagem_id, idioma });
      return aiGatewayErrorResponse(r, corsHeaders);
    }

    const texto: string | undefined = r.data?.choices?.[0]?.message?.content?.trim();
    if (!texto) {
      return jsonResponse({ error: "IA retornou resposta vazia" }, 502, corsHeaders);
    }

    // 4. Salva no cache (upsert para race condition: 2 usuários pedindo ao mesmo tempo)
    await admin
      .from("mensagens_traducoes")
      .upsert({ mensagem_id, idioma, texto }, { onConflict: "mensagem_id,idioma" });

    // 5. Retorna
    return jsonResponse({ texto, cached: false }, 200, corsHeaders);
  },
);
