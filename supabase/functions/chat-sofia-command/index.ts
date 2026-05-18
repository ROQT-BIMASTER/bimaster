// chat-sofia-command — comandos da Sofia inline no chat corporativo.
//
// Suporta 2 comandos por enquanto:
//   /sofia <pergunta>  → IA responde diretamente no chat
//   /resumir           → IA resume últimas 50 mensagens da conversa
//
// Fluxo:
//   1. Valida JWT + participação na conversa.
//   2. Para /sofia: prompt = mensagem do user.
//      Para /resumir: carrega mensagens + monta prompt de resumo.
//   3. Chama callAIGateway (Gemini Flash).
//   4. INSERT em public.mensagens com remetente_id = caller uid,
//      tipo='sistema', metadata={ sofia: true, command }.
//      A UI (MessageBubble) renderiza diferente quando metadata.sofia=true.
//
// Por que remetente_id = uid e não um sentinela "SOFIA_USER_ID"?
// Adicionar um profile fixo da Sofia exigiria seed em profiles + RLS
// considerar esse uid como sempre legível. Mais simples: a resposta
// "vem" do user que pediu (ele é o autor do comando), e o front
// renderiza com avatar/nome da Sofia via metadata. Funciona pra v1.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logger } from "../_shared/logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT_SOFIA =
  "Você é a Sofia, assistente do bimaster integrada ao chat corporativo. " +
  "Responda em português brasileiro de forma objetiva e profissional. " +
  "Quando a pergunta for sobre dados ou processos internos que você não tem, " +
  "diga isso claramente em vez de inventar. Limite respostas a 4 parágrafos curtos.";

const SYSTEM_PROMPT_RESUMIR =
  "Você é a Sofia, assistente do bimaster. Resuma a conversa abaixo entre " +
  "membros de uma equipe. Use bullets com no máximo 6 itens, destacando: " +
  "decisões tomadas, pendências, e quem ficou responsável pelo quê. " +
  "Se a conversa tiver pouca substância, diga isso em 1 frase em vez de inventar bullets.";

interface Body {
  conversa_id?: string;
  command?: "sofia" | "resumir";
  prompt?: string;
}

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "chat-sofia-command" },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: Body = {};
    try { body = await req.json(); } catch {
      return jsonResponse({ error: "JSON inválido" }, 400, corsHeaders);
    }

    const { conversa_id, command, prompt } = body;
    if (!conversa_id || !command || !["sofia", "resumir"].includes(command)) {
      return jsonResponse(
        { error: "conversa_id e command (sofia|resumir) são obrigatórios" },
        400, corsHeaders,
      );
    }
    if (command === "sofia" && (!prompt || prompt.trim().length < 1)) {
      return jsonResponse({ error: "prompt obrigatório para /sofia" }, 400, corsHeaders);
    }

    const uid = ctx.userId!;

    // 1. Valida participação na conversa
    const { data: part } = await admin
      .from("conversas_participantes")
      .select("usuario_id")
      .eq("conversa_id", conversa_id)
      .eq("usuario_id", uid)
      .is("saiu_em", null)
      .maybeSingle();
    if (!part) return jsonResponse({ error: "Sem permissão" }, 403, corsHeaders);

    // 2. Monta prompt
    const messages: { role: string; content: string }[] = [];
    if (command === "sofia") {
      messages.push({ role: "system", content: SYSTEM_PROMPT_SOFIA });
      messages.push({ role: "user", content: prompt!.trim() });
    } else {
      // /resumir — carrega últimas 50 mensagens da conversa
      const { data: msgs } = await admin
        .from("mensagens")
        .select("conteudo, remetente_id, created_at")
        .eq("conversa_id", conversa_id)
        .eq("excluida_para_todos", false)
        .order("created_at", { ascending: false })
        .limit(50);
      const ids = [...new Set((msgs ?? []).map((m: any) => m.remetente_id))];
      const { data: profs } = ids.length
        ? await admin.from("profiles").select("id, nome").in("id", ids)
        : { data: [] as any[] };
      const nomeById = new Map((profs ?? []).map((p: any) => [p.id, p.nome ?? "Usuário"]));
      const conversa = (msgs ?? []).slice().reverse().map((m: any) =>
        `${nomeById.get(m.remetente_id) ?? "Usuário"}: ${m.conteudo}`
      ).join("\n");
      if (!conversa) {
        return jsonResponse({ error: "Conversa vazia — nada a resumir" }, 400, corsHeaders);
      }
      messages.push({ role: "system", content: SYSTEM_PROMPT_RESUMIR });
      messages.push({ role: "user", content: conversa });
    }

    // 3. Chama IA
    const r = await callAIGateway({ model: MODEL, timeoutMs: 45_000, messages });
    if (r.kind !== "ok") {
      logger.error("chat-sofia-command IA falhou", { kind: r.kind, command, conversa_id });
      return aiGatewayErrorResponse(r, corsHeaders);
    }
    const texto: string | undefined = r.data?.choices?.[0]?.message?.content?.trim();
    if (!texto) return jsonResponse({ error: "IA retornou vazio" }, 502, corsHeaders);

    // 4. Insere resposta como mensagem com metadata.sofia=true
    const { data: inserted, error: insErr } = await admin
      .from("mensagens")
      .insert({
        conversa_id,
        remetente_id: uid,
        conteudo: texto,
        tipo: "sistema",
        metadata: { sofia: true, command, prompt: prompt ?? null },
      })
      .select("id")
      .single();
    if (insErr) {
      logger.error("chat-sofia-command insert falhou", { insErr });
      return jsonResponse({ error: "Falha ao gravar resposta" }, 500, corsHeaders);
    }

    return jsonResponse({ ok: true, message_id: inserted.id, texto }, 200, corsHeaders);
  },
));
