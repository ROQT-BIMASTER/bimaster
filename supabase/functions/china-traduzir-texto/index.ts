// supabase/functions/china-traduzir-texto/index.ts
// Traduz um texto avulso (laudo, parecer, observação) para PT/ZH/EN
// e devolve { origem, traducoes }. A persistência do cache é responsabilidade
// do chamador (geralmente em china_doc_revisoes.motivo_traducoes/contestacao_traducoes).
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z.object({
  texto: z.string().min(1).max(8000),
  origem: z.enum(["pt", "zh", "en"]).optional(),
}).strict();

const SYSTEM = `Você é um tradutor profissional especializado em comunicação técnica entre fábricas chinesas e equipes brasileiras de cosméticos/regulatório.

REGRAS OBRIGATÓRIAS:
- Traduza apenas o texto enviado, sem comentários adicionais.
- Mantenha intactos: códigos de produto (ex.: LDS0025), códigos de OC, nomes INCI, números, EANs, unidades de medida.
- Mantenha menções @nome.
- Tom profissional, objetivo, natural no idioma de destino.
- Se a entrada estiver vazia ou for só pontuação, devolva exatamente igual.
- Devolva SOMENTE a tradução, sem aspas, sem prefixos.`;

const LANG_NAME: Record<string, string> = {
  pt: "Português brasileiro",
  zh: "中文 (Mandarim simplificado)",
  en: "English",
};

function detectLang(s: string): "pt" | "zh" | "en" {
  if (/[\u4e00-\u9fff]/.test(s)) return "zh";
  if (/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(s) || /\b(de|para|não|com|que|aprovação|rejeição)\b/i.test(s)) return "pt";
  return "en";
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 120, rateLimitPrefix: "china-traduzir-texto" },
  async (req, _ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const texto = parsed.data.texto.trim();
    const origem = parsed.data.origem || detectLang(texto);
    const alvos = (["pt", "zh", "en"] as const).filter((l) => l !== origem);
    const traducoes: Record<string, string> = { [origem]: texto };

    for (const alvo of alvos) {
      const r = await callAIGateway({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Traduza o texto a seguir para ${LANG_NAME[alvo]}. Não adicione comentários.\n\nTexto:\n${texto}`,
          },
        ],
      });
      if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);
      traducoes[alvo] = (r.data.choices?.[0]?.message?.content || "").trim();
    }

    return new Response(JSON.stringify({ origem, traducoes }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
