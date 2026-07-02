import { logger } from "./logger.ts";
// _shared/ai-gateway-call.ts — wrapper único para o Lovable AI Gateway.
// Responsável por:
//  - timeout via AbortController (default 60s) — evita pendurar a edge
//  - fallback de modelo quando 429/402 (pro -> flash -> flash-lite)
//  - tradução de erros do gateway em códigos estáveis para o caller
//
// Uso:
//   const r = await callAIGateway({ messages, model: "google/gemini-3-flash-preview" });
//   if (r.kind === "ok") { ... } else { return aiGatewayErrorResponse(r, corsHeaders); }
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const FALLBACK_CHAIN: Record<string, string | null> = {
  "google/gemini-2.5-pro": "google/gemini-3-flash-preview",
  "google/gemini-3-flash-preview": "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash": "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash-lite": null,
  "openai/gpt-5.5-pro": "openai/gpt-5.5",
  "openai/gpt-5.5": "openai/gpt-5.2",
  "openai/gpt-5.4-pro": "openai/gpt-5.4",
  "openai/gpt-5.4": "openai/gpt-5.2",
  "openai/gpt-5": "openai/gpt-5-mini",
  "openai/gpt-5.2": "openai/gpt-5-mini",
  "openai/gpt-5-mini": "openai/gpt-5-nano",
  "openai/gpt-5-nano": "google/gemini-3-flash-preview",
};

export interface CallAIGatewayInput {
  messages: any[];
  model: string;
  tools?: any[];
  tool_choice?: any;
  reasoning?: { effort: "minimal" | "low" | "medium" | "high" | "xhigh" };
  /** Default 60s. */
  timeoutMs?: number;
  /** Permite cair para modelo mais leve em 429/402. Default true. */
  allowFallback?: boolean;
}

export type CallAIGatewayResult =
  | { kind: "ok"; data: any; modelUsed: string }
  | { kind: "rate_limited"; status: 429; modelTried: string }
  | { kind: "payment_required"; status: 402; modelTried: string }
  | { kind: "timeout"; modelTried: string }
  | { kind: "upstream"; status: number; bodyText: string; modelTried: string };

export async function callAIGateway(input: CallAIGatewayInput): Promise<CallAIGatewayResult> {
  const timeoutMs = input.timeoutMs ?? 60_000;
  const allowFallback = input.allowFallback ?? true;

  let model = input.model;
  let attempts = 0;

  while (attempts < 3) {
    attempts++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
      stream: false,
    };
    if (input.tools) body.tools = input.tools;
    if (input.tool_choice) body.tool_choice = input.tool_choice;
    // Defesa: o Lovable AI Gateway rejeita `reasoning` em modelos OpenAI (gpt-5.2 etc.) com 400.
    // Mantemos o parâmetro apenas para Google/Gemini.
    if (input.reasoning && !model.startsWith("openai/")) body.reasoning = input.reasoning;

    try {
      const r = await fetch(AI_GATEWAY, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      clearTimeout(timer);

      if (r.ok) {
        const data = await r.json();
        return { kind: "ok", data, modelUsed: model };
      }

      if (r.status === 429 || r.status === 402) {
        // Drena body para evitar leak antes do fallback
        await r.text().catch(() => "");
        const next = allowFallback ? FALLBACK_CHAIN[model] : null;
        if (next) {
          logger.warn(`[ai-gateway] ${r.status} em ${model}, fallback -> ${next}`);
          model = next;
          continue;
        }
        return r.status === 429
          ? { kind: "rate_limited", status: 429, modelTried: model }
          : { kind: "payment_required", status: 402, modelTried: model };
      }

      const txt = await r.text().catch(() => "");
      logger.error(`[ai-gateway] ${r.status} em ${model}:`, txt.slice(0, 500));
      return { kind: "upstream", status: r.status, bodyText: txt, modelTried: model };
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") {
        logger.error(`[ai-gateway] timeout (${timeoutMs}ms) em ${model}`);
        const next = allowFallback ? FALLBACK_CHAIN[model] : null;
        if (next) {
          model = next;
          continue;
        }
        return { kind: "timeout", modelTried: model };
      }
      throw e;
    }
  }

  return { kind: "upstream", status: 500, bodyText: "exhausted attempts", modelTried: model };
}

// Mensagens traduzidas para PT/EN/ZH. Usadas quando o caller passa `lang`
// (derivado do Accept-Language ou do header `x-client-country` propagado pelo
// Cloudflare Worker — ver cloudflare/worker.js, rota /api/functions/*).
const ERR_MESSAGES = {
  rate_limited: {
    pt: "Limite de uso atingido. Tente novamente em alguns instantes.",
    en: "Rate limit reached. Please try again shortly.",
    zh: "请求频率过高，请稍后再试。",
  },
  payment_required: {
    pt: "Créditos de IA insuficientes. Adicione créditos no workspace.",
    en: "Insufficient AI credits. Please add credits in the workspace.",
    zh: "AI 额度不足，请在工作区充值。",
  },
  timeout: {
    pt: "O assistente demorou demais para responder. Em redes da China continental a latência pode ser maior — tente novamente.",
    en: "The assistant took too long to respond. From mainland China the latency may be higher — please retry.",
    zh: "助手响应超时。中国大陆网络可能延迟较高，请重试。",
  },
  upstream: {
    pt: "Erro no provedor de IA. Tente novamente.",
    en: "AI provider error. Please retry.",
    zh: "AI 服务出错，请重试。",
  },
} as const;

type Lang = "pt" | "en" | "zh";

export function pickLang(req: Request): Lang {
  const country = (req.headers.get("x-client-country") || "").toUpperCase();
  if (country === "CN") return "zh";
  const al = (req.headers.get("accept-language") || "").toLowerCase();
  if (al.startsWith("zh")) return "zh";
  if (al.startsWith("en")) return "en";
  return "pt";
}

export function aiGatewayErrorResponse(
  result: Exclude<CallAIGatewayResult, { kind: "ok" }>,
  corsHeaders: Record<string, string>,
  lang: Lang = "pt",
): Response {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  if (result.kind === "rate_limited") {
    return new Response(JSON.stringify({ error: ERR_MESSAGES.rate_limited[lang] }), { status: 429, headers });
  }
  if (result.kind === "payment_required") {
    return new Response(JSON.stringify({ error: ERR_MESSAGES.payment_required[lang] }), { status: 402, headers });
  }
  if (result.kind === "timeout") {
    return new Response(JSON.stringify({ error: ERR_MESSAGES.timeout[lang] }), { status: 504, headers });
  }
  return new Response(JSON.stringify({ error: ERR_MESSAGES.upstream[lang] }), { status: 502, headers });
}
