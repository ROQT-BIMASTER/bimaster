// china-translate-labels — preenche label_pt/label_cn/label_en faltantes
// usando o Lovable AI Gateway (Gemini Flash). Cada item passa por cache
// (`china_label_traducoes`) antes de chamar o modelo. Cada chamada (hit,
// IA ou falha) é registrada em `china_label_traducao_log` para diagnóstico.
//
// Robustez: falha em um item não derruba o lote — o item recai no
// fallback (PT→EN→CN) e fica marcado como `fallback` no log.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const MODEL = "google/gemini-3-flash-preview";
const MAX_OUTPUT_TOKENS = 8192;

const ItemSchema = z.object({
  id: z.string().min(1).max(120),
  pt: z.string().max(500).optional().default(""),
  cn: z.string().max(500).optional().default(""),
  en: z.string().max(500).optional().default(""),
}).strict();

const BodySchema = z.object({
  items: z.array(ItemSchema).min(1).max(50),
  context: z.string().max(200).optional(),
  submissaoId: z.string().uuid().optional(),
  entidade: z.string().max(60).optional(),
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

interface OutItem { id: string; pt: string; cn: string; en: string; fonte: "ai" | "cache_hit" | "fallback" }

function fallback(input: { pt?: string; cn?: string; en?: string }) {
  const pt = (input.pt || "").trim();
  const cn = (input.cn || "").trim();
  const en = (input.en || "").trim();
  return {
    pt: pt || en || cn || "",
    cn: cn || pt || en || "",
    en: en || pt || cn || "",
  };
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function pickOrigin(it: { pt?: string; cn?: string; en?: string }): { texto: string; idioma: "pt" | "cn" | "en" } {
  if (it.pt && it.pt.trim()) return { texto: it.pt.trim(), idioma: "pt" };
  if (it.en && it.en.trim()) return { texto: it.en.trim(), idioma: "en" };
  if (it.cn && it.cn.trim()) return { texto: it.cn.trim(), idioma: "cn" };
  return { texto: "", idioma: "pt" };
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 60, rateLimitPrefix: "china-translate-labels" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const t0 = Date.now();

    let raw: unknown;
    try { raw = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { items, context, submissaoId, entidade } = parsed.data;
    const ctxKey = context || "checklist-china";
    const userId = ctx?.userId ?? null;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Hashes por item (idioma de origem + texto + contexto)
    const meta = await Promise.all(items.map(async (i) => {
      const origin = pickOrigin(i);
      const hash = await sha256Hex(`${ctxKey}|${origin.idioma}|${origin.texto}`);
      return { id: i.id, origin, hash, input: i };
    }));

    // 2) Consulta cache em batch
    const allHashes = meta.map(m => m.hash).filter(h => h.length > 0);
    const cacheMap = new Map<string, any>();
    if (allHashes.length > 0) {
      const { data: cached } = await sb.rpc("rpc_translation_cache_get_batch", { p_hashes: allHashes });
      for (const c of (cached || [])) cacheMap.set(c.hash, c);
    }

    const out: OutItem[] = new Array(meta.length);
    const toModel: Array<{ idx: number; m: typeof meta[number] }> = [];

    for (let i = 0; i < meta.length; i++) {
      const m = meta[i];
      const cached = cacheMap.get(m.hash);
      if (cached && (cached.label_pt || cached.label_cn || cached.label_en)) {
        // Combina cache com input — input vence se o usuário já preencheu
        const merged = fallback({
          pt: m.input.pt || cached.label_pt,
          cn: m.input.cn || cached.label_cn,
          en: m.input.en || cached.label_en,
        });
        out[i] = { id: m.id, ...merged, fonte: "cache_hit" };
        // log cache_hit (best-effort)
        sb.rpc("rpc_translation_log_write", {
          p_submissao_id: submissaoId ?? null,
          p_entidade: entidade ?? null,
          p_entidade_id: m.id,
          p_texto_origem: m.origin.texto,
          p_contexto: ctxKey,
          p_status: "cache_hit",
          p_modelo: cached.modelo_usado ?? null,
          p_payload: null,
          p_erro_msg: null,
          p_duracao_ms: 0,
          p_user_id: userId,
        }).then(() => {}, () => {});
        continue;
      }
      // Item completo (já tem PT/CN/EN) e sem cache → grava cache + segue
      if (m.input.pt?.trim() && m.input.cn?.trim() && m.input.en?.trim()) {
        out[i] = { id: m.id, pt: m.input.pt!, cn: m.input.cn!, en: m.input.en!, fonte: "cache_hit" };
        sb.rpc("rpc_translation_cache_put", {
          p_hash: m.hash,
          p_texto_origem: m.origin.texto,
          p_idioma_origem: m.origin.idioma,
          p_contexto: ctxKey,
          p_label_pt: m.input.pt!,
          p_label_cn: m.input.cn!,
          p_label_en: m.input.en!,
          p_fonte: "manual",
          p_modelo: null,
        }).then(() => {}, () => {});
        continue;
      }
      // Item totalmente vazio → não chama IA
      if (!m.origin.texto) {
        out[i] = { id: m.id, pt: "", cn: "", en: "", fonte: "fallback" };
        continue;
      }
      toModel.push({ idx: i, m });
    }

    // 3) Chama IA apenas para o que falta
    if (toModel.length > 0) {
      const userPayload = {
        context: ctxKey,
        items: toModel.map(({ m }) => ({
          id: m.id,
          pt: m.input.pt || null,
          cn: m.input.cn || null,
          en: m.input.en || null,
        })),
      };

      const r = await callAIGateway({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
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

      if (r.kind !== "ok") {
        // Falha global do gateway → marca todos os pendentes como fallback e loga
        for (const { idx, m } of toModel) {
          const fb = fallback(m.input);
          out[idx] = { id: m.id, ...fb, fonte: "fallback" };
          sb.rpc("rpc_translation_log_write", {
            p_submissao_id: submissaoId ?? null,
            p_entidade: entidade ?? null,
            p_entidade_id: m.id,
            p_texto_origem: m.origin.texto,
            p_contexto: ctxKey,
            p_status: "falha",
            p_modelo: MODEL,
            p_payload: null,
            p_erro_msg: `gateway: ${r.kind}`,
            p_duracao_ms: Date.now() - t0,
            p_user_id: userId,
          }).then(() => {}, () => {});
        }
        // Devolve 200 com fallback (não derruba a UI)
        const failures = toModel.length;
        return new Response(JSON.stringify({
          items: out,
          meta: { cacheHits: meta.length - failures, aiCalls: 0, failures, durationMs: Date.now() - t0 },
        }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }

      let parsedOut: any = null;
      try {
        const content: string = r.data.choices?.[0]?.message?.content ?? "{}";
        const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        parsedOut = JSON.parse(cleaned);
      } catch (e) {
        parsedOut = { items: [] };
      }
      const arr = Array.isArray(parsedOut?.items) ? parsedOut.items : [];
      const byId = new Map<string, any>(arr.map((x: any) => [String(x?.id ?? ""), x]));

      for (const { idx, m } of toModel) {
        const got = byId.get(m.id);
        if (got) {
          const pt = (m.input.pt || "").trim() || String(got.pt || "").trim();
          const cn = (m.input.cn || "").trim() || String(got.cn || "").trim();
          const en = (m.input.en || "").trim() || String(got.en || "").trim();
          const merged = fallback({ pt, cn, en });
          out[idx] = { id: m.id, ...merged, fonte: "ai" };
          // grava cache
          sb.rpc("rpc_translation_cache_put", {
            p_hash: m.hash,
            p_texto_origem: m.origin.texto,
            p_idioma_origem: m.origin.idioma,
            p_contexto: ctxKey,
            p_label_pt: merged.pt,
            p_label_cn: merged.cn,
            p_label_en: merged.en,
            p_fonte: "ai",
            p_modelo: MODEL,
          }).then(() => {}, () => {});
          sb.rpc("rpc_translation_log_write", {
            p_submissao_id: submissaoId ?? null,
            p_entidade: entidade ?? null,
            p_entidade_id: m.id,
            p_texto_origem: m.origin.texto,
            p_contexto: ctxKey,
            p_status: "sucesso",
            p_modelo: MODEL,
            p_payload: got,
            p_erro_msg: null,
            p_duracao_ms: Date.now() - t0,
            p_user_id: userId,
          }).then(() => {}, () => {});
        } else {
          const fb = fallback(m.input);
          out[idx] = { id: m.id, ...fb, fonte: "fallback" };
          sb.rpc("rpc_translation_log_write", {
            p_submissao_id: submissaoId ?? null,
            p_entidade: entidade ?? null,
            p_entidade_id: m.id,
            p_texto_origem: m.origin.texto,
            p_contexto: ctxKey,
            p_status: "fallback",
            p_modelo: MODEL,
            p_payload: parsedOut,
            p_erro_msg: "item ausente na resposta da IA",
            p_duracao_ms: Date.now() - t0,
            p_user_id: userId,
          }).then(() => {}, () => {});
        }
      }
    }

    const aiCalls = toModel.length;
    const cacheHits = meta.length - aiCalls;
    const failures = out.filter(o => o?.fonte === "fallback").length;

    return new Response(JSON.stringify({
      items: out,
      meta: { cacheHits, aiCalls, failures, durationMs: Date.now() - t0 },
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  },
));
