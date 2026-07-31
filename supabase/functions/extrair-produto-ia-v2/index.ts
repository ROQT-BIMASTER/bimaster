import { z } from "https://esm.sh/zod@3.23.8";
import { logger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de cadastro de produtos a partir de textos ou imagens de sistemas ERP.

Analise o conteúdo fornecido e extraia o máximo de informações possível para preencher o cadastro de um produto acabado.

Você DEVE retornar APENAS um JSON com os campos abaixo (use null para campos não encontrados):

{
  "codigo": "código interno do produto",
  "sku": "SKU do produto",
  "codigo_barras_ean": "código de barras EAN/GTIN",
  "codigo_legado": "código do sistema anterior/legado",
  "nome": "nome completo do produto",
  "nome_comercial": "nome comercial/de vendas",
  "descricao_curta": "descrição resumida",
  "descricao_completa": "descrição detalhada",
  "categoria": "categoria principal",
  "subcategoria": "subcategoria",
  "linha": "linha de produtos",
  "marca": "marca",
  "fabricante": "fabricante",
  "modelo": "modelo",
  "versao_variacao": "versão ou variação",
  "ncm": "código NCM (Nomenclatura Comum do Mercosul)",
  "origem": "nacional ou importado",
  "tipo_rotulagem": "sticker, label, sleeve, tag ou outro",
  "unidade_medida": "unidade de medida (UN, KG, CX, LT, etc.)",
  "rendimento": "rendimento numérico se disponível",
  "tempo_producao_minutos": "tempo de produção em minutos se disponível"
}

Regras:
- Extraia TODOS os campos que conseguir identificar no texto/imagem
- Se um campo não for encontrado, use null
- Para "origem", interprete termos como "importado", "nacional", "made in brazil" etc.
- Código de barras deve ser apenas números
- NCM deve estar no formato XX.XX.XX.XX ou XXXX.XX.XX
- Não invente dados, extraia apenas o que está presente
- Retorne SOMENTE o JSON, sem markdown, sem explicações`;

const Body = z
  .object({
    text: z.string().min(1).max(20000).optional(),
    imageBase64: z.string().min(1).max(14_000_000).optional(),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 10, rateLimitPrefix: "extrair-produto-ia-v2" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        });

      try {
        const parsed = Body.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) {
          return json({ error: "Requisição inválida" }, 400);
        }

        const { text, imageBase64 } = parsed.data;
        if (!text && !imageBase64) {
          return json({ error: "Forneça texto ou imagem para análise" }, 400);
        }

        const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];

        if (imageBase64) {
          const url = imageBase64.startsWith("data:")
            ? imageBase64
            : `data:image/png;base64,${imageBase64}`;
          messages.push({
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise esta imagem de um sistema ERP e extraia os dados do produto cadastrado. Retorne APENAS o JSON estruturado.",
              },
              { type: "image_url", image_url: { url } },
            ],
          });
        } else {
          messages.push({
            role: "user",
            content: `Analise o seguinte texto copiado de um sistema ERP e extraia os dados do produto:\n\n${text}`,
          });
        }

        const model = imageBase64
          ? "google/gemini-2.5-pro"
          : "google/gemini-3-flash-preview";

        const r = await callAIGateway({ model, messages, timeoutMs: 75_000 });
        if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

        const content: string = r.data?.choices?.[0]?.message?.content ?? "";
        let jsonStr = content.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        const start = jsonStr.indexOf("{");
        const end = jsonStr.lastIndexOf("}");
        if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);

        let extractedData: Record<string, unknown>;
        try {
          extractedData = JSON.parse(jsonStr);
        } catch {
          logger.error("Falha ao interpretar resposta da IA");
          return json(
            { error: "Não foi possível interpretar a resposta da análise. Tente novamente." },
            502,
          );
        }

        return json({ data: extractedData, model: r.modelUsed });
      } catch (error) {
        logger.error("Error:", error);
        return json({ error: "Erro ao processar dados" }, 500);
      }
    },
  ),
);
