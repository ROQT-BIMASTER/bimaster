// china-translate-labels — preenche label_pt/label_cn/label_en faltantes
// usando o Lovable AI Gateway (Gemini Flash). Retorna sempre os 3 idiomas
// para cada item; em caso de falha, mantém o input (best-effort).
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const ItemSchema = z.object({
  id: z.string().min(1).max(120),
  pt: z.string().max(500).optional().default(""),
  cn: z.string().max(500).optional().default(""),
  en: z.string().max(500).optional().default(""),
}).strict();

const BodySchema = z.object({
  items: z.array(ItemSchema).min(1).max(50),
  context: z.string().max(200).optional(),
}).strict();

const SYSTEM_PROMPT = `Você traduz rótulos curtos de checklist técnico (cosméticos / fábrica China-Brasil) entre PT-BR, 中文 (Simplificado) e EN.

Regras:
- Mantenha termos técnicos consagrados: "Mockup", "Arte Final", "INCI", "BOM", "MOQ".
- "Dados Oficiais" → "Official Data" / "官方数据".
- "Composição" → "Composition" / "成分".
- "Amostras" → "Samples" / "样品".
- "Desenhos Técnicos" → "Technical Drawings" / "技术图纸".
- Rótulos curtos (1-6 palavras), sem ponto final.
- Se o usuário já preencheu um idioma, NÃO altere — só preencha os vazios.
- Devolva APENAS JSON válido no formato pedido. Sem markdown.`;

interface OutItem { id: string; pt: string; cn: string; en: string }

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 60, rateLimitPrefix: "china-translate-labels" },
  async (req, _ctx) => {
    const cors = getCorsHeaders(req);

    let raw: unknown;
    try { raw = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { items, context } = parsed.data;

    // No-op: todos os itens já têm os 3 idiomas
    const needsWork = items.some(i => !i.pt.trim() || !i.cn.trim() || !i.en.trim());
    if (!needsWork) {
      return new Response(JSON.stringify({ items: items.map(i => ({ id: i.id, pt: i.pt, cn: i.cn, en: i.en })) }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const userPayload = {
      context: context || "Checklist de documentos da fábrica China.",
      items: items.map(i => ({ id: i.id, pt: i.pt || null, cn: i.cn || null, en: i.en || null })),
    };

    const r = await callAIGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content:
`Preencha os idiomas vazios (null) deste lote. Devolva JSON estrito:
{"items":[{"id":"...","pt":"...","cn":"...","en":"..."}]}

Entrada:
${JSON.stringify(userPayload)}` },
      ],
      response_format: { type: "json_object" } as any,
    } as any);

    if (r.kind !== "ok") return aiGatewayErrorResponse(r as any, cors);

    let out: OutItem[] = [];
    try {
      const content: string = r.data.choices?.[0]?.message?.content ?? "{}";
      const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsedOut = JSON.parse(cleaned);
      const arr = Array.isArray(parsedOut?.items) ? parsedOut.items : [];
      const byId = new Map<string, any>(arr.map((x: any) => [String(x?.id ?? ""), x]));
      out = items.map(i => {
        const got = byId.get(i.id) || {};
        const pt = (i.pt || "").trim() || String(got.pt || "").trim();
        const cn = (i.cn || "").trim() || String(got.cn || "").trim();
        const en = (i.en || "").trim() || String(got.en || "").trim();
        return {
          id: i.id,
          pt: pt || en || cn || "",
          cn: cn || pt || en || "",
          en: en || pt || cn || "",
        };
      });
    } catch (e) {
      console.warn("[china-translate-labels] parse fail, returning input", e);
      out = items.map(i => ({ id: i.id, pt: i.pt, cn: i.cn, en: i.en }));
    }

    return new Response(JSON.stringify({ items: out }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
