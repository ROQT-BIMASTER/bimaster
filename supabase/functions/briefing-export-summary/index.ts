// supabase/functions/briefing-export-summary/index.ts
// Gera resumo executivo e mensagem-chave para exportação de briefing.
// NÃO substitui o agente de chat (briefing-agent) — é uma função auxiliar isolada.

import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z
  .object({
    titulo: z.string().min(1).max(500),
    tipo: z.string().min(1).max(80),
    campos: z.record(z.string(), z.string()).default({}),
    idioma: z.enum(["pt", "en", "zh"]).default("pt"),
    nivel: z.enum(["executivo", "completo", "tecnico"]).default("executivo"),
  })
  .strict();

const idiomaLabel = {
  pt: "Português brasileiro",
  en: "English",
  zh: "中文（简体）",
} as const;

const nivelLabel = {
  executivo: "executivo (1 parágrafo curto e direto, foco em valor de negócio)",
  completo: "completo (2-3 parágrafos com contexto, audiência, execução)",
  tecnico: "técnico (detalhado, com riscos, dependências e premissas)",
} as const;

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "briefing-export-summary" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const raw = await req.json().catch(() => null);
      const parsed = Body.safeParse(raw);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: parsed.error.flatten() }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const { titulo, tipo, campos, idioma, nivel } = parsed.data;

      const camposTxt = Object.entries(campos)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `- ${k}: ${v.trim()}`)
        .join("\n");

      const system = `Você produz resumos executivos de briefings de marketing/produto.
Idioma da saída: ${idiomaLabel[idioma]}.
Nível: ${nivelLabel[nivel]}.
Retorne SEMPRE um JSON estrito com as chaves: resumo (string), mensagem_chave (string curta, até 140 caracteres), riscos (array de strings curtas, no máximo 4). Sem markdown, sem texto fora do JSON.`;

      const user = `Briefing "${titulo}" (tipo: ${tipo}).\n\nCampos preenchidos:\n${camposTxt || "(nenhum campo preenchido)"}`;

      const r = await callAIGateway({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

      const content: string = r.data?.choices?.[0]?.message?.content ?? "";
      let payload: { resumo: string; mensagem_chave: string; riscos: string[] } = {
        resumo: "",
        mensagem_chave: "",
        riscos: [],
      };
      try {
        const cleaned = content.trim().replace(/^```json\s*|```$/g, "");
        const parsedJson = JSON.parse(cleaned);
        payload = {
          resumo: String(parsedJson.resumo ?? ""),
          mensagem_chave: String(parsedJson.mensagem_chave ?? ""),
          riscos: Array.isArray(parsedJson.riscos)
            ? parsedJson.riscos.slice(0, 4).map((x: unknown) => String(x))
            : [],
        };
      } catch {
        payload.resumo = content;
      }

      return new Response(JSON.stringify(payload), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    },
  ),
);
