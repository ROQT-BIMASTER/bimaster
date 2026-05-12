// supabase/functions/china-chat-traduzir/index.ts
// Traduz mensagens do chat China–Brasil para PT/ZH/EN e cacheia
// em china_chat_mensagens.traducoes (jsonb). Idempotente — só
// chama o gateway para idiomas ainda não cacheados.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse, pickLang } from "../_shared/ai-gateway-call.ts";

const Body = z.object({
  mensagem_id: z.string().uuid(),
}).strict();

const SYSTEM = `Você é um tradutor profissional especializado em comunicação técnica entre fábricas chinesas e equipes brasileiras de cosméticos/regulatório.

REGRAS OBRIGATÓRIAS:
- Traduza apenas o texto enviado, sem comentários adicionais.
- Mantenha intactos: códigos de produto (ex.: LDS0025), códigos de OC, nomes INCI, números, EANs, unidades de medida.
- Mantenha menções @nome.
- Tom profissional, objetivo, natural no idioma de destino.
- Se a entrada estiver vazia ou for só pontuação, devolva exatamente igual.
- Devolva SOMENTE a tradução, sem aspas, sem prefixos.`;

const LANG_NAME: Record<string, string> = { pt: "Português brasileiro", zh: "中文 (Mandarim simplificado)", en: "English" };

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 120, rateLimitPrefix: "china-chat-traduzir" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: msg, error: errMsg } = await sb
      .from("china_chat_mensagens")
      .select("id, conteudo, idioma_origem, traducoes")
      .eq("id", parsed.data.mensagem_id)
      .maybeSingle();
    if (errMsg || !msg) {
      return new Response(JSON.stringify({ error: "Mensagem não encontrada" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const conteudo = (msg.conteudo || "").trim();
    if (!conteudo) {
      return new Response(JSON.stringify({ ok: true, skipped: "empty" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Detectar idioma origem (heurística simples) se ainda não detectado.
    let origem = (msg.idioma_origem as string | null) || detectLang(conteudo);
    const traducoesAtual = (msg.traducoes as Record<string, string> | null) || {};

    const alvos = (["pt", "zh", "en"] as const).filter((l) => l !== origem && !traducoesAtual[l]);
    if (alvos.length === 0) {
      // Apenas garante idioma_origem persistido
      if (!msg.idioma_origem) {
        await sb.from("china_chat_mensagens").update({ idioma_origem: origem } as any).eq("id", msg.id);
      }
      return new Response(JSON.stringify({ ok: true, skipped: "cached", origem }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const novas: Record<string, string> = { ...traducoesAtual };

    for (const alvo of alvos) {
      const r = await callAIGateway({
        model: "google/gemini-3-flash-preview",
        timeoutMs: 25_000,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Traduzir do ${LANG_NAME[origem] ?? origem} para ${LANG_NAME[alvo]}:\n\n${conteudo}`,
          },
        ],
      });
      if (r.kind !== "ok") {
        // Retorna o que conseguiu; cacheia parcial.
        if (Object.keys(novas).length > Object.keys(traducoesAtual).length) {
          await sb.from("china_chat_mensagens").update({ traducoes: novas, idioma_origem: origem } as any).eq("id", msg.id);
        }
        return aiGatewayErrorResponse(r, cors, pickLang(req));
      }
      const text = (r.data?.choices?.[0]?.message?.content || "").trim();
      if (text) novas[alvo] = text;
    }

    await sb.from("china_chat_mensagens").update({
      traducoes: novas,
      idioma_origem: origem,
    } as any).eq("id", msg.id);

    return new Response(JSON.stringify({ ok: true, traducoes: novas, idioma_origem: origem }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));

function detectLang(text: string): "pt" | "zh" | "en" {
  // CJK ideogramas
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  // Acentos PT
  if (/[ãáéíóúâêôçàÃÁÉÍÓÚÂÊÔÇÀ]/.test(text)) return "pt";
  // Palavras-chave PT comuns
  if (/\b(de|para|com|não|você|nós|por|que|está|então)\b/i.test(text)) return "pt";
  // Default EN
  return "en";
}
